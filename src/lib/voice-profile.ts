// 语音偏好进化系统 — 六维语音偏好 + 行为信号检测 + 情绪映射
// 复用现有 preference-updater 的信号→偏好 delta 模式

import type { VoiceProfile } from './db'

export type EmotionKey = 'sadness' | 'anxiety' | 'anger' | 'joy' | 'calm' | 'fear' | 'frustration' | 'numb'

export type VoiceSignalType =
  | 'stop_playback'    // 用户中途停止播放
  | 'replay'           // 用户重播
  | 'play_full'        // 完整听完
  | 'volume_up'        // 用户调大音量
  | 'volume_down'      // 用户调小音量
  | 'manual_adjust'    // 用户手动调整设置
  | 'speed_up'         // 用户调快语速
  | 'speed_down'       // 用户调慢语速

export type VoiceSignal = {
  type: VoiceSignalType
  dimension?: 'speed' | 'pitch' | 'volume' | 'expressiveness' | 'pause_style' | 'warmth'
  value?: number          // 调整后的值（仅 manual_adjust）
}

const DEFAULT_SIGNAL_EFFECTS: Record<VoiceSignalType, {
  dimension: keyof VoiceProfile
  delta: number           // 基础偏移量
  confidenceDelta: number // 置信度偏移
  oppositeDelta?: number  // 对侧方向偏移
}> = {
  stop_playback:   { dimension: 'speed', delta: -0.08, oppositeDelta: 0.03, confidenceDelta: -0.05 },
  speed_up:        { dimension: 'speed_confidence', delta: 0, confidenceDelta: 0.1 },
  speed_down:      { dimension: 'speed_confidence', delta: 0, confidenceDelta: 0.1 },
  replay:          { dimension: 'expressiveness', delta: 0.05, confidenceDelta: 0.05 },
  play_full:       { dimension: 'speed', delta: 0.02, confidenceDelta: 0.03 },
  volume_up:       { dimension: 'volume', delta: 0.05, confidenceDelta: 0.05 },
  volume_down:     { dimension: 'volume', delta: -0.05, confidenceDelta: 0.05 },
  manual_adjust:   { dimension: 'speed', delta: 0, confidenceDelta: 0.2 },
}

export function applyVoiceSignal(
  profile: VoiceProfile,
  signal: VoiceSignal,
): VoiceProfile {
  const effect = DEFAULT_SIGNAL_EFFECTS[signal.type]
  if (!effect) return profile

  const updated = { ...profile }
  const dim = effect.dimension

  if (signal.type === 'manual_adjust' && signal.value !== undefined && signal.dimension) {
    // 手动调整：直接设值，大幅提升置信度
    const confKey = `${signal.dimension}_confidence` as keyof VoiceProfile
    ;(updated as any)[signal.dimension] = signal.value
    ;(updated as any)[confKey] = Math.min(0.95, ((updated as any)[confKey] || 0.3) + 0.2)
    return updated
  }

  // Speed up / down 特殊处理
  if (signal.type === 'speed_up') {
    updated.speed = Math.min(1.5, updated.speed + 0.1)
    updated.speed_confidence = Math.min(0.95, updated.speed_confidence + 0.1)
    return updated
  }
  if (signal.type === 'speed_down') {
    updated.speed = Math.max(0.5, updated.speed - 0.1)
    updated.speed_confidence = Math.min(0.95, updated.speed_confidence + 0.1)
    return updated
  }

  // 常规 delta 更新
  const currentVal = (updated as any)[dim] as number
  if (typeof currentVal === 'number') {
    ;(updated as any)[dim] = clampDimension(dim, currentVal + effect.delta)
  }

  // 置信度更新
  const confKey = `${String(dim)}_confidence` as keyof VoiceProfile
  const curConf = (updated as any)[confKey] as number
  if (typeof curConf === 'number') {
    ;(updated as any)[confKey] = clampConfidence(curConf + effect.confidenceDelta)
  }

  // 对侧方向偏移（负向信号时尝试对侧值）
  if (effect.oppositeDelta && typeof currentVal === 'number') {
    const oppositeVal = getOppositeValue(dim, currentVal)
    ;(updated as any)[dim] = interpolate(currentVal, oppositeVal, effect.oppositeDelta)
  }

  return updated
}

// 情绪 → 语音参数偏移映射
export type VoiceEmotionMap = {
  speed: number
  pitch: number
  volume: number
  expressiveness: number
  pause_style: number
}

const EMOTION_VOICE_MAP: Record<EmotionKey, VoiceEmotionMap> = {
  sadness:    { speed: -0.2, pitch: -0.2, volume: -0.1, expressiveness: -0.1, pause_style: 0.1 },
  anxiety:    { speed: 0.15, pitch: 0.15, volume: 0.05, expressiveness: 0.1, pause_style: 0.2 },
  anger:      { speed: 0.1, pitch: 0.1, volume: 0.2, expressiveness: 0.15, pause_style: 0 },
  joy:        { speed: 0.1, pitch: 0.15, volume: 0.1, expressiveness: 0.2, pause_style: -0.1 },
  calm:       { speed: -0.1, pitch: -0.05, volume: -0.05, expressiveness: -0.1, pause_style: 0 },
  fear:       { speed: 0.2, pitch: 0.2, volume: -0.15, expressiveness: 0.1, pause_style: 0.3 },
  frustration: { speed: 0.1, pitch: 0.1, volume: 0.15, expressiveness: 0.1, pause_style: 0 },
  numb:       { speed: 0, pitch: -0.1, volume: -0.1, expressiveness: -0.2, pause_style: 0.15 },
}

export function getEffectiveVoiceParams(
  profile: VoiceProfile,
  emotion?: EmotionKey,
): { speed: number; pitch: number; volume: number; voice_id: string } {
  let speed = profile.speed
  let pitch = profile.pitch
  let volume = profile.volume

  if (emotion && EMOTION_VOICE_MAP[emotion]) {
    const offset = EMOTION_VOICE_MAP[emotion]
    // 仅应用置信度 >= 0.3 的维度的情绪偏移
    if (profile.speed_confidence < 0.8) speed = clampDimension('speed', speed + offset.speed)
    if (profile.pitch_confidence < 0.8) pitch = clampDimension('pitch', pitch + offset.pitch)
    if (profile.volume_confidence < 0.8) volume = clampDimension('volume', volume + offset.volume)
  }

  // warmth → voice_id 映射
  const voice_id = profile.voice_id || getVoiceForWarmth(profile.warmth, profile.provider)

  return { speed, pitch, volume, voice_id }
}

// ===== 工具函数 =====

function getVoiceForWarmth(warmth: string, provider: string): string {
  if (provider === 'openai-tts') {
    switch (warmth) {
      case 'warm': return 'nova'
      case 'cool': return 'alloy'
      default: return 'shimmer'
    }
  }
  return '' // expo-speech / web-speech 用系统默认
}

function clampDimension(dim: string, val: number): number {
  const ranges: Record<string, [number, number]> = {
    speed: [0.5, 1.5],
    pitch: [0.5, 1.5],
    volume: [0.3, 1.0],
    expressiveness: [0.3, 1.0],
    pause_style: [0.3, 1.0],
  }
  const [min, max] = ranges[dim] || [0, 1]
  return Math.max(min, Math.min(max, val))
}

function clampConfidence(val: number): number {
  return Math.max(0.05, Math.min(0.95, val))
}

function getOppositeValue(dim: string, current: number): number {
  const midpoints: Record<string, number> = {
    speed: 1.0,
    pitch: 1.0,
    volume: 0.65,
    expressiveness: 0.65,
    pause_style: 0.65,
  }
  const mid = midpoints[dim] || 0.65
  return mid + (mid - current)
}

function interpolate(a: number, b: number, t: number): number {
  return a + (b - a) * Math.min(1, Math.abs(t))
}
