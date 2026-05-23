// 文本预处理管线 — 让 AI 文本朗读起来自然无 AI 味
// 处理顺序：去 Markdown → 去 AI 味句式 → emoji→语调 → 自然节奏 → 中文语气优化

const AI_PATTERNS: [RegExp, string][] = [
  [/我理解你的感受[，。!！]?/g, '嗯，我懂'],
  [/我明白你的意思[，。!！]?/g, '嗯，明白'],
  [/从你的描述来看[，。!！]?/g, '听起来'],
  [/根据我的分析[，。!！]?/g, '我觉得'],
  [/基于你所说的情况[，。!！]?/g, '这样来看'],
  [/作为一个人工智能[，。!！]?/g, ''],
  [/作为一个AI[，。!！]?/g, ''],
  [/作为一个语言模型[，。!！]?/g, ''],
  [/总的来说[，。!！]?/g, ''],
  [/总而言之[，。!！]?/g, ''],
  [/首先[，]?/g, ''],
  [/其次[，]?/g, ''],
  [/最后[，]?/g, ''],
  [/需要注意的是[，。!！]?/g, '嗯不过'],
  [/我建议你[，]?/g, '要不'],
  [/你可以试试[，]?/g, '试试'],
  [/如果你愿意的话[，。!！]?/g, ''],
]

const EMOJI_MAP: Record<string, string> = {
  '😊': ' [[warm]] ',
  '😢': ' [[sad]] ',
  '😤': ' [[frustrated]] ',
  '😡': ' [[angry]] ',
  '😰': ' [[anxious]] ',
  '😌': ' [[calm]] ',
  '😄': ' [[bright]] ',
  '😔': ' [[sad]] ',
  '💪': ' [[encouraging]] ',
  '🤗': ' [[warm]] ',
  '🧠': ' [[pause]] ',
  '📝': ' [[pause]] ',
  '💡': ' [[pause]] ',
  '✅': ' [[affirmative]] ',
  '⚠️': ' [[warning]] ',
}

const EMOJI_KEYS = Object.keys(EMOJI_MAP)
const EMOJI_PATTERN = new RegExp(EMOJI_KEYS.map(e => e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g')

export type EmotionContext = 'sadness' | 'anxiety' | 'anger' | 'joy' | 'calm' | 'fear' | 'frustration' | 'numb' | undefined

// 情绪 → 语速/语调标签映射
const EMOTION_TAGS: Record<string, { speed: string; volume: string }> = {
  sadness: { speed: '[[slow]]', volume: '[[soft]]' },
  anxiety: { speed: '[[slightly_fast]]', volume: '[[neutral]]' },
  anger: { speed: '[[slightly_fast]]', volume: '[[loud]]' },
  joy: { speed: '[[slightly_fast]]', volume: '[[bright]]' },
  calm: { speed: '[[slow]]', volume: '[[soft]]' },
  fear: { speed: '[[slow]]', volume: '[[soft]]' },
  frustration: { speed: '[[slightly_fast]]', volume: '[[neutral]]' },
  numb: { speed: '[[slow]]', volume: '[[very_soft]]' },
}

export function preprocessForTTS(raw: string, emotionContext?: EmotionContext): string {
  if (!raw) return ''

  let text = raw

  // 1. 去 Markdown
  text = text
    .replace(/\*\*(.*?)\*\*/g, '$1')         // **bold**
    .replace(/__(.*?)__/g, '$1')               // __italic__
    .replace(/~~(.*?)~~/g, '$1')               // ~~strikethrough~~
    .replace(/`([^`]+)`/g, '$1')               // `code`
    .replace(/^#{1,6}\s+/gm, '')               // # headings
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [text](url) → text
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '图片') // ![alt](url)
    .replace(/^[\-*]\s+/gm, '')               // list markers
    .replace(/^\d+\.\s+/gm, '')              // numbered list
    .replace(/\|(.+?)\|/g, '$1')              // table cells
    .replace(/^[-|\s]+$/gm, '')               // table separators

  // 2. 去 AI 味句式
  for (const [pattern, replacement] of AI_PATTERNS) {
    text = text.replace(pattern, replacement)
  }

  // 3. emoji → 语调标记
  let hasEmotionTag = false
  text = text.replace(EMOJI_PATTERN, (match) => {
    hasEmotionTag = true
    return EMOJI_MAP[match] || ' '
  })

  // 4. 添加自然节奏标记
  text = text
    // 段落间隔
    .replace(/\n\n+/g, ' [[pause_long]] ')
    // 句号后
    .replace(/[。！？]/g, (m) => {
      if (m === '。') return '。[[pause]]'
      if (m === '！') return '！[[emphasis]]'
      return '？[[rise]]'
    })
    // 逗号后
    .replace(/[，、；：]/g, '，[[short_pause]]')
    // 破折号
    .replace(/——/g, '——[[dramatic_pause]]')
    // 省略号
    .replace(/……/g, '……[[pause_medium]]')

  // 5. 清理多余空格和标记
  text = text.replace(/\s+/g, ' ').trim()

  // 6. 前置情绪标签（仅在无明显表情标签时）
  if (emotionContext && !hasEmotionTag && EMOTION_TAGS[emotionContext]) {
    const tags = EMOTION_TAGS[emotionContext]
    text = `${tags.speed} ${tags.volume} ${text}`
  }

  return text
}

export function stripMarkers(text: string): string {
  // 移除所有 [[...]] 标记，得到纯净文本
  return text.replace(/\[\[[^\]]+\]\]/g, '').replace(/\s+/g, ' ').trim()
}
