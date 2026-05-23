// 信号检测：纯正则规则引擎，+3ms 预算

export type SignalKey =
  | 'agreement'
  | 'gratitude'
  | 'emotional_resonance'
  | 'self_disclosure'
  | 'disagreement'
  | 'topic_abandonment'
  | 'short_reply'
  | 'confusion'
  | 'continued_engagement'

export type SignalType = 'positive' | 'negative' | 'neutral'

export interface SignalResult {
  signal_type: SignalType
  signal_key: SignalKey
  confidence: number
  detection_layer: 'regex'
  context: {
    matched_text?: string
    message_length?: number
    response_length?: number
  }
}

// 积极信号正则
const gratitudePatterns = [
  /谢谢|多谢|感谢|辛苦了|感恩|thanks/i,
  /帮了大忙|太有用了|很有帮助|受益/i,
]

const agreementPatterns = [
  /你说得对|确实|没错|是啊|对对对|有道理|真(的)?是(这样|的)/i,
  /我同意|赞同|认可|同意你说的/i,
  /嗯嗯?$|嗯好|好的吧/,
]

const emotionalResonancePatterns = [
  /说到我心坎(里|上)了|太懂我了|被你看穿了|你怎么知道/i,
  /就是这样|一模一样|完全一致|感同身受/i,
  /说到(点|关键)上了/,
]

const selfDisclosurePatterns = [
  /其实我(一直|总是|经常|从来)|我发现自己|我意识到/i,
  /跟你说个(秘密|事)|我从没跟人说过|第一次跟人说/i,
  /我(小时候|以前|曾经|从小)/,
]

// 消极信号正则
const disagreementPatterns = [
  /不是(这样|的)|不对|你说得不对|不是你想的那样/i,
  /但是|可是|然而|不过|其实(不是|没)/i,
]

const topicAbandonmentPatterns = [
  /算了(不说了|不提了|没事)|不提这个了|不说这个了|跳过吧/i,
  /换个话题|不说我了|聊聊你|不聊这个/i,
  /没事了|没什么|就这样吧/i,
]

const confusionPatterns = [
  /什么意思|没明白|没懂|不理解|不懂|没听懂/i,
  /能再说(一遍|一次)吗|什么意思|怎么理解/i,
]

export function detectSignals(
  text: string,
  responseLength?: number,
): SignalResult[] {
  const results: SignalResult[] = []
  const messageLength = text.length

  // --- 长度检查 ---
  const trimmed = text.trim()

  // 短回复检测（<= 15 字，且不是 affirmation）
  if (trimmed.length <= 15) {
    const isAffirmation = /^(嗯|好的|好|行|哦|ok|嗯嗯|是|对|可以|知道|明白|试试|我试试|收到|了解|行吧|可|中|妥)$/i.test(trimmed)
    if (!isAffirmation) {
      results.push({
        signal_type: 'negative',
        signal_key: 'short_reply',
        confidence: 0.7,
        detection_layer: 'regex',
        context: { message_length: messageLength, response_length: responseLength },
      })
    }
  }

  // --- 积极信号 ---
  if (testPatterns(text, gratitudePatterns)) {
    results.push({
      signal_type: 'positive',
      signal_key: 'gratitude',
      confidence: 0.9,
      detection_layer: 'regex',
      context: { matched_text: extractMatch(text, gratitudePatterns), message_length: messageLength, response_length: responseLength },
    })
  }

  if (testPatterns(text, agreementPatterns)) {
    results.push({
      signal_type: 'positive',
      signal_key: 'agreement',
      confidence: 0.85,
      detection_layer: 'regex',
      context: { matched_text: extractMatch(text, agreementPatterns), message_length: messageLength, response_length: responseLength },
    })
  }

  if (testPatterns(text, emotionalResonancePatterns)) {
    results.push({
      signal_type: 'positive',
      signal_key: 'emotional_resonance',
      confidence: 0.9,
      detection_layer: 'regex',
      context: { matched_text: extractMatch(text, emotionalResonancePatterns), message_length: messageLength, response_length: responseLength },
    })
  }

  if (testPatterns(text, selfDisclosurePatterns)) {
    results.push({
      signal_type: 'positive',
      signal_key: 'self_disclosure',
      confidence: 0.85,
      detection_layer: 'regex',
      context: { matched_text: extractMatch(text, selfDisclosurePatterns), message_length: messageLength, response_length: responseLength },
    })
  }

  // 继续参与检测：消息长度 > 30 字，没有消极信号，且包含参与度指标
  if (trimmed.length > 30 && !results.some(r => r.signal_type === 'negative')) {
    const hasEngagementIndicator =
      /我(感觉|觉得|想|发现|认为|知道|理解|明白)|[？?]|然后|还有|其实|因为|所以|但是|可是|不过|确实|真的/i.test(trimmed)
    if (hasEngagementIndicator) {
      results.push({
        signal_type: 'positive',
        signal_key: 'continued_engagement',
        confidence: 0.7,
        detection_layer: 'regex',
        context: { message_length: messageLength, response_length: responseLength },
      })
    }
  }

  // --- 消极信号 ---
  if (testPatterns(text, disagreementPatterns)) {
    results.push({
      signal_type: 'negative',
      signal_key: 'disagreement',
      confidence: 0.8,
      detection_layer: 'regex',
      context: { matched_text: extractMatch(text, disagreementPatterns), message_length: messageLength, response_length: responseLength },
    })
  }

  if (testPatterns(text, topicAbandonmentPatterns)) {
    results.push({
      signal_type: 'negative',
      signal_key: 'topic_abandonment',
      confidence: 0.85,
      detection_layer: 'regex',
      context: { matched_text: extractMatch(text, topicAbandonmentPatterns), message_length: messageLength, response_length: responseLength },
    })
  }

  if (testPatterns(text, confusionPatterns)) {
    results.push({
      signal_type: 'negative',
      signal_key: 'confusion',
      confidence: 0.9,
      detection_layer: 'regex',
      context: { matched_text: extractMatch(text, confusionPatterns), message_length: messageLength, response_length: responseLength },
    })
  }

  return results
}

function testPatterns(text: string, patterns: RegExp[]): boolean {
  return patterns.some(p => p.test(text))
}

function extractMatch(text: string, patterns: RegExp[]): string | undefined {
  for (const p of patterns) {
    const m = text.match(p)
    if (m) return m[0].trim()
  }
  return undefined
}

/**
 * Cold start explicit preference detection.
 * Detects when user directly states a preference (e.g., "别太温柔", "直接一点").
 */
export function detectExplicitPreference(text: string): { dimension: string; value: string } | null {
  // 语气风格 (tone) — 支持否定前缀取反
  const TONE_OPPOSITES: Record<string, string> = {
    gentle: 'direct', direct: 'gentle',
    warm: 'neutral', neutral: 'warm',
  }
  const toneMatch = text.match(/(别|不要|少|太)(温柔|直接|温暖|中性)|(温柔|直接|温暖|中性)[的一]点/)
  if (toneMatch) {
    const prefix = toneMatch[1]
    const val = toneMatch[2] || toneMatch[3]
    const toneMap: Record<string, string> = { 温柔: 'gentle', 直接: 'direct', 温暖: 'warm', 中性: 'neutral' }
    if (toneMap[val]) {
      const mapped = toneMap[val]
      if (prefix) return { dimension: 'tone', value: TONE_OPPOSITES[mapped] || mapped }
      return { dimension: 'tone', value: mapped }
    }
  }

  // 建议方式 (advice_style) — 正确读取两组捕获组
  const adviceMatch = text.match(/(不要|少|别)?(分析|建议|反思|共情|指引)|(实用|情感|反思|灵性)[的些一]/)
  if (adviceMatch) {
    const negate = adviceMatch[1]
    const keyword = adviceMatch[2] || adviceMatch[3]
    const adviceMap: Record<string, string> = {
      分析: 'reflective', 建议: 'practical', 反思: 'reflective', 共情: 'emotional', 指引: 'spiritual',
      实用: 'practical', 情感: 'emotional', 灵性: 'spiritual',
    }
    const ADVICE_OPPOSITES: Record<string, string> = {
      reflective: 'practical', practical: 'reflective',
      emotional: 'spiritual', spiritual: 'emotional',
    }
    if (keyword) {
      const base = adviceMap[keyword]
      if (negate) return { dimension: 'advice_style', value: ADVICE_OPPOSITES[base] || base }
      return { dimension: 'advice_style', value: base }
    }
    return { dimension: 'advice_style', value: 'emotional' }
  }

  // 直言接受度 (confrontation_comfort)
  if (/直说|直接说|别委婉|不用委婉|有话直说/.test(text)) {
    return { dimension: 'confrontation_comfort', value: 'direct_honest' }
  }
  if (/温柔点|柔和点|别太直接|委婉/.test(text)) {
    return { dimension: 'confrontation_comfort', value: 'always_soothe' }
  }

  return null
}
