// 偏好更新：信号 → 6 维偏好模型置信度调整
// 所有计算在内存中完成，写入库异步

import type { SignalResult } from './signal-detector.ts'

export interface PreferenceDimension {
  dimension: string
  value: string
  confidence: number
  sample_count: number
  history: Array<{ value: string; confidence: number; timestamp: string }>
}

// 各维度可取值
export const DIMENSION_VALUES: Record<string, string[]> = {
  tone: ['gentle', 'direct', 'warm', 'neutral'],
  advice_style: ['reflective', 'practical', 'emotional', 'spiritual'],
  confrontation_comfort: ['always_soothe', 'gentle_challenge', 'direct_honest'],
  humor: ['none', 'light', 'moderate'],
  response_depth: ['surface', 'moderate', 'deep'],
  emotional_expressiveness: ['restrained', 'moderate', 'expressive'],
}

// 信号 → 维度桥接规则：{dimension, delta, opposite_boost?}
// positive 信号：目标维度置信度 +0.1（上限 0.95）
// negative 信号：目标维度置信度 -0.15，对面值 +0.05
const SIGNAL_BRIDGE: Record<string, Array<{ dimension: string; positiveDelta: number; negativeDelta: number; oppositeValue?: string }>> = {
  gratitude: [
    { dimension: 'tone', positiveDelta: 0.1, negativeDelta: -0.15 },
    { dimension: 'advice_style', positiveDelta: 0.1, negativeDelta: -0.15 },
  ],
  agreement: [
    { dimension: 'tone', positiveDelta: 0.1, negativeDelta: -0.15 },
    { dimension: 'advice_style', positiveDelta: 0.1, negativeDelta: -0.15 },
  ],
  emotional_resonance: [
    { dimension: 'emotional_expressiveness', positiveDelta: 0.1, negativeDelta: -0.15, oppositeValue: 'restrained' },
    { dimension: 'response_depth', positiveDelta: 0.1, negativeDelta: -0.15, oppositeValue: 'surface' },
  ],
  self_disclosure: [
    { dimension: 'response_depth', positiveDelta: 0.1, negativeDelta: -0.15, oppositeValue: 'surface' },
    { dimension: 'emotional_expressiveness', positiveDelta: 0.1, negativeDelta: -0.15 },
  ],
  disagreement: [
    { dimension: 'tone', positiveDelta: 0.05, negativeDelta: -0.15, oppositeValue: 'direct' },
    { dimension: 'confrontation_comfort', positiveDelta: 0.05, negativeDelta: -0.15, oppositeValue: 'gentle_challenge' },
  ],
  short_reply: [
    { dimension: 'response_depth', positiveDelta: 0.05, negativeDelta: -0.15, oppositeValue: 'surface' },
    { dimension: 'advice_style', positiveDelta: 0.05, negativeDelta: -0.15 },
  ],
  topic_abandonment: [
    { dimension: 'confrontation_comfort', positiveDelta: 0.05, negativeDelta: -0.15, oppositeValue: 'always_soothe' },
  ],
  confusion: [
    { dimension: 'response_depth', positiveDelta: 0.05, negativeDelta: -0.15, oppositeValue: 'surface' },
    { dimension: 'advice_style', positiveDelta: 0.05, negativeDelta: -0.15, oppositeValue: 'practical' },
  ],
  continued_engagement: [
    { dimension: 'response_depth', positiveDelta: 0.08, negativeDelta: -0.1 },
    { dimension: 'emotional_expressiveness', positiveDelta: 0.08, negativeDelta: -0.1 },
  ],
}

export interface PreferenceUpdate {
  dimension: string
  old_value: string
  new_value: string
  old_confidence: number
  new_confidence: number
  change_type: 'reinforce' | 'weaken' | 'shift'
}

/**
 * 根据信号更新偏好模型。
 * 纯函数，返回更新列表供调用方持久化。
 */
export function updatePreferences(
  signals: SignalResult[],
  currentPreferences: PreferenceDimension[],
): PreferenceUpdate[] {
  const updates: PreferenceUpdate[] = []
  const prefMap = new Map(currentPreferences.map(p => [p.dimension, p]))

  for (const signal of signals) {
    const bridgeRules = SIGNAL_BRIDGE[signal.signal_key]
    if (!bridgeRules) continue

    for (const rule of bridgeRules) {
      const pref = prefMap.get(rule.dimension)
      if (!pref) continue

      const dimValues = DIMENSION_VALUES[rule.dimension]
      if (!dimValues) continue

      let newConfidence: number
      let newValue = pref.value
      let changeType: 'reinforce' | 'weaken' | 'shift' = 'reinforce'

      if (signal.signal_type === 'positive') {
        // 积极信号：强化当前值
        newConfidence = Math.min(0.95, pref.confidence + rule.positiveDelta)
        changeType = 'reinforce'
      } else {
        // 消极信号：削弱当前值
        newConfidence = Math.max(0.1, pref.confidence + rule.negativeDelta)

        // 如果置信度低于 0.3 且定义了对面值，尝试切换
        if (newConfidence < 0.3 && rule.oppositeValue && dimValues.includes(rule.oppositeValue)) {
          newValue = rule.oppositeValue
          newConfidence = 0.4 // 切换到对面值后赋予基础置信度
          changeType = 'shift'
        } else if (newConfidence < 0.3 && pref.sample_count > 3) {
          // 多次削弱后尝试维度内的最近值（按索引距离排序）
          const others = dimValues.filter(v => v !== pref.value)
          if (others.length > 0) {
            const currentIdx = dimValues.indexOf(pref.value)
            others.sort((a, b) => Math.abs(dimValues.indexOf(a) - currentIdx) - Math.abs(dimValues.indexOf(b) - currentIdx))
            newValue = others[0]
            newConfidence = 0.4
            changeType = 'shift'
          }
        } else {
          changeType = 'weaken'
        }
      }

      if (newConfidence !== pref.confidence || newValue !== pref.value) {
        updates.push({
          dimension: rule.dimension,
          old_value: pref.value,
          new_value: newValue,
          old_confidence: pref.confidence,
          new_confidence: newConfidence,
          change_type: changeType,
        })
      }
    }
  }

  return updates
}

/**
 * 初始化默认偏好维度。
 */
export function createDefaultPreferences(): PreferenceDimension[] {
  const now = new Date().toISOString()
  return [
    { dimension: 'tone', value: 'gentle', confidence: 0.5, sample_count: 1, history: [{ value: 'gentle', confidence: 0.5, timestamp: now }] },
    { dimension: 'advice_style', value: 'reflective', confidence: 0.5, sample_count: 1, history: [{ value: 'reflective', confidence: 0.5, timestamp: now }] },
    { dimension: 'confrontation_comfort', value: 'always_soothe', confidence: 0.5, sample_count: 1, history: [{ value: 'always_soothe', confidence: 0.5, timestamp: now }] },
    { dimension: 'humor', value: 'light', confidence: 0.5, sample_count: 1, history: [{ value: 'light', confidence: 0.5, timestamp: now }] },
    { dimension: 'response_depth', value: 'moderate', confidence: 0.5, sample_count: 1, history: [{ value: 'moderate', confidence: 0.5, timestamp: now }] },
    { dimension: 'emotional_expressiveness', value: 'moderate', confidence: 0.5, sample_count: 1, history: [{ value: 'moderate', confidence: 0.5, timestamp: now }] },
  ]
}

/**
 * Cold start 阶段：用户明确回答偏好探测问题后，直接设置信度为 0.6。
 */
export function applyExplicitPreference(
  current: PreferenceDimension,
  explicitValue: string,
): PreferenceUpdate {
  return {
    dimension: current.dimension,
    old_value: current.value,
    new_value: explicitValue,
    old_confidence: current.confidence,
    new_confidence: 0.6,
    change_type: 'reinforce',
  }
}
