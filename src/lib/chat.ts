// 聊天引擎 — 直接调用 AI API（支持 OpenAI / Anthropic 格式）
// 所有数据存储在本地（AsyncStorage），与 API Key 解耦

import { getApiKey, getApiSettings, KEYS } from './storage'
import { detectSignals, detectExplicitPreference } from '../supabase/functions/chat/signal-detector'
import { updatePreferences, createDefaultPreferences, applyExplicitPreference } from '../supabase/functions/chat/preference-updater'
import { buildSystemPrompt, type PromptContext } from '../supabase/functions/chat/prompt-builder'
import * as db from './db'
import { generateId } from './utils'

export type StreamEvent = {
  type: 'thought' | 'text' | 'tool_call' | 'assessment' | 'action_suggested' | 'structured_output' | 'done' | 'error' | 'session_end' | 'rumination_hint' | 'recall'
  content: string
}

export type ChatRequest = {
  message: string
  conversation_id?: string
  mode?: 'chat' | 'journal' | 'low_power' | 'emergency'
  personality?: string
  images?: Array<{ data: string; media_type: string }>
  audio?: { data: string; mime_type: string }
}

// generateId() 在 React Native Hermes 中不存在，需要 fallback
export async function* streamChat(
  req: ChatRequest,
  signal?: AbortSignal,
): AsyncGenerator<StreamEvent> {
  const { message, conversation_id, mode = 'chat', images, audio } = req

  // --- 读取 API 配置 ---
  const apiKey = await getApiKey(KEYS.ANTHROPIC_API_KEY)
  if (!apiKey) {
    yield { type: 'error', content: '请先在设置中配置 API Key' }
    return
  }
  const settings = await getApiSettings()

  // --- 本地数据上下文 ---
  const profile = await db.getProfile()
  const existingPrefs = await db.getPreferences()
  const preferences = existingPrefs.length > 0 ? existingPrefs : createDefaultPreferences()

  // --- 日志模式：直接保存，不调 AI ---
  if (mode === 'journal') {
    const convId = conversation_id || generateId()
    if (!conversation_id) {
      await db.saveConversation({ id: convId, mode, current_round: 0, created_at: new Date().toISOString() })
    }
    await db.addMessage(convId, {
      id: generateId(), role: 'user', content: message,
      created_at: new Date().toISOString(),
    })
    await db.addMessage(convId, {
      id: generateId(), role: 'assistant', content: '已记录 📝',
      created_at: new Date().toISOString(),
    })
    yield { type: 'text', content: '已记录 📝' }
    yield { type: 'done', content: JSON.stringify({ conversation_id: convId }) }
    return
  }

  // --- 信号检测（低电量/急救模式跳过，节能） ---
  if (mode !== 'low_power' && mode !== 'emergency') {
    const signals = detectSignals(message, undefined)
    if (signals.length > 0) {
      const now = new Date().toISOString()
      const dimPrefs = existingPrefs.map(p => ({
        dimension: p.dimension,
        value: p.value,
        confidence: p.confidence,
        sample_count: (p as any).sample_count || 1,
        history: [{ value: p.value, confidence: p.confidence, timestamp: now }],
      }))
      const updated = updatePreferences(signals, dimPrefs)
      await db.savePreferences(updated.map((u: any) => ({ dimension: u.dimension, value: u.new_value || u.value, confidence: u.new_confidence || u.confidence })))
    }

    // Cold start 偏好探测
    if (profile.learning_stage === 'cold_start') {
      const explicitPref = detectExplicitPreference(message)
      if (explicitPref && existingPrefs.length > 0) {
        const matched = existingPrefs.find(p => p.dimension === explicitPref.dimension)
        if (matched) {
          const current = {
            dimension: matched.dimension,
            value: matched.value,
            confidence: matched.confidence,
            sample_count: 0,
            history: [],
          }
          const update = applyExplicitPreference(current, explicitPref.value)
          const newPrefs = existingPrefs.map(p =>
            p.dimension === update.dimension
              ? { ...p, value: update.new_value, confidence: update.new_confidence }
              : p
          )
          await db.savePreferences(newPrefs)
        }
      }
    }
  }

  // --- 加载记忆 ---
  const memories = await db.getMemories()
  const topMemories = memories.sort((a, b) => b.weight - a.weight).slice(0, 2)
  const recentMemories = topMemories.map(m => ({ content: m.content, weight: m.weight, emotion_tag: m.emotion_tag, category: m.category }))

  // 点击记忆权重递增
  for (const m of topMemories) {
    await db.updateMemory(m.id, { weight: (m.weight || 1) + 1 })
  }

  // --- 加载活跃话题 ---
  const topics = await db.getTopics()
  const activeTopics = topics.filter(t => t.keywords.length > 0)

  // --- 加载自定义动作 ---
  const actions = await db.getCustomActions()

  // --- 构建 System Prompt ---
  const promptCtx: PromptContext = {
    learning_stage: profile.learning_stage as any,
    interaction_count: profile.interaction_count,
    time_period: getTimePeriod(),
    focus_mode: 'personal',
    preferences: preferences.map(p => ({ dimension: p.dimension, value: p.value, confidence: p.confidence })),
    personality_prompt: profile.personality_prompt,
    current_personality: req.personality || profile.current_personality,
    vocabulary_map: profile.vocabulary_map,
    active_topics: activeTopics.map(t => ({
      keywords: t.keywords,
      last_emotion_state: t.last_emotion_state,
      mention_count: t.mention_count,
    })),
    memories: recentMemories,
    custom_actions: actions.map(a => ({
      trigger_emotion: a.trigger_emotion,
      action_description: a.action_description,
      effectiveness_score: a.effectiveness_score,
    })),
    mode,
    previous_assessment: (profile as any).last_assessment || undefined,
  }

  const systemPrompt = buildSystemPrompt(promptCtx)

  // --- 加载对话历史（支持摘要滑动窗口） ---
  const historyMessages: Array<{ role: string; content: any }> = []
  if (conversation_id) {
    const allMsgs = await db.getMessages(conversation_id)
    const summaries = await db.getConversationSummaries(conversation_id)

    if (summaries.length > 0) {
      // 从摘要中恢复压缩的上下文
      for (const s of summaries) {
        historyMessages.push({
          role: 'user',
          content: `[历史摘要] ${s.summary}${s.key_topics.length > 0 ? '（关键词：' + s.key_topics.join('、') + '）' : ''}`,
        })
      }
      // 添加最新的未摘要消息
      const lastSummarizedIndex = summaries[summaries.length - 1].end_index
      const recentMsgs = allMsgs.slice(lastSummarizedIndex + 1)
      for (const m of recentMsgs) {
        if (m.role === 'user' || m.role === 'assistant') {
          historyMessages.push({ role: m.role, content: m.content })
        }
      }
    } else {
      // 无摘要，直接取最近 20 条
      for (const m of allMsgs.slice(-20)) {
        if (m.role === 'user' || m.role === 'assistant') {
          historyMessages.push({ role: m.role, content: m.content })
        }
      }
    }
  }

  // --- 获取/创建对话 ---
  let convId = conversation_id
  if (!convId) {
    convId = generateId()
    await db.saveConversation({ id: convId, mode, current_round: 0, created_at: new Date().toISOString() })
  }

  // --- 保存用户消息 ---
  const userMsg: db.Message = {
    id: generateId(), role: 'user', content: message,
    created_at: new Date().toISOString(),
  }
  await db.addMessage(convId, userMsg)

  // --- 更新轮次 ---
  const convs = await db.getConversations()
  const conv = convs.find(c => c.id === convId)
  if (conv) {
    conv.current_round++
    await db.saveConversation(conv)
  }

  // --- 更新 interaction_count ---
  profile.interaction_count++
  profile.learning_stage = getLearningStage(profile.interaction_count)
  await db.saveProfile(profile)

  // --- 构建用户消息（含图片支持） ---
  // --- 构建用户消息（含图片、语音支持） ---
  const contentParts: any[] = [{ type: 'text', text: message }]
  if (images?.length) {
    for (const img of images) {
      contentParts.push({ type: 'image', source: { type: 'base64', media_type: img.media_type, data: img.data } })
    }
  }
  if (audio) {
    contentParts.push({ type: 'text', text: '[用户发来了一段语音消息。请根据上下文分析其情绪状态并回复]' })
  }
  const userContent: any = (images?.length || audio) ? contentParts : message

  const allMessages: any[] = [
    ...historyMessages,
    { role: 'user', content: userContent },
  ]

  const tools = getTools()
  let finalResponse: string | undefined
  let lastThinkContext: string | undefined

  // 低电量/急救模式限制轮次，节能快速
  const maxTurns = mode === 'emergency' ? 1 : mode === 'low_power' ? 2 : 2

  for (let turn = 0; turn < maxTurns; turn++) {
    let result: { content: any[] }
    try {
      // 急救模式不传 tools（跳过 think 工具要求），低电量仅首轮传 tools
      const useTools = turn === 0
        ? (mode === 'emergency' ? undefined : tools)
        : undefined
      result = await callAPI(settings, systemPrompt, allMessages, useTools, signal)
    } catch (err) {
      // Text-only model support: retry without tools if error mentions tools
      if (turn === 0 && err instanceof Error && err.message?.toLowerCase().includes('tool')) {
        console.warn('[chat] Tools not supported, retrying without tools')
        try {
          result = await callAPI(settings, systemPrompt, allMessages, undefined, signal)
        } catch (retryErr) {
          console.error('[chat] Retry without tools also failed:', retryErr)
          throw new Error(`API 调用失败: ${retryErr instanceof Error ? retryErr.message : retryErr}`)
        }
      } else {
        console.error(`[chat] API call failed on turn ${turn}:`, err)
        throw new Error(`API 调用失败（第 ${turn + 1} 轮）: ${err instanceof Error ? err.message : err}`)
      }
    }
    const content = result.content

    const toolUses = content.filter((block: any) => block.type === 'tool_use')
    const textBlock = content.find((block: any) => block.type === 'text')

    // 如果有工具调用，处理它们
    for (const tool of toolUses) {
      const toolName = tool.name as string
      const args = tool.input as Record<string, unknown> || {}

      if (toolName === 'think') {
        if (args.analysis || args.strategy) {
          const thoughtContent = [
            args.analysis ? `**分析**：${args.analysis}` : '',
            args.strategy ? `**策略**：${args.strategy}` : '',
          ].filter(Boolean).join('\n\n')

          // 保存 think 上下文供后续指令使用
          lastThinkContext = [args.analysis, args.strategy].filter(Boolean).join('；').slice(0, 300)

          yield { type: 'thought', content: thoughtContent }

          await db.addMessage(convId, {
            id: generateId(), role: 'thought', content: thoughtContent,
            created_at: new Date().toISOString(),
          })

          if (args.assess_previous_response) {
            const assess = args.assess_previous_response as Record<string, unknown>
            yield { type: 'assessment', content: JSON.stringify(assess) }
            const msgs = await db.getMessages(convId)
            const lastAssistant = [...msgs].reverse().find(m => m.role === 'assistant')
            if (lastAssistant && assess.quality_score) {
              await db.updateMessage(convId, lastAssistant.id, {
                quality_score: assess.quality_score as number,
              })
            }
            // 保存评估结果到 profile，下次对话时注入 prompt
            if (assess.quality_overall) {
              profile.last_assessment = String(assess.quality_overall).slice(0, 200)
              await db.saveProfile(profile)
            }
          }

          if (args.detected_topic) {
            const topic = args.detected_topic as Record<string, unknown>
            const existingTopics = await db.getTopics()
            if (topic.is_new_topic) {
              existingTopics.push({
                keywords: topic.topic_keywords as string[],
                last_emotion_state: topic.emotion_state as string,
                mention_count: 1,
                last_mentioned_at: new Date().toISOString(),
              })
            } else {
              const existing = existingTopics.find(
                t => t.keywords.length === (topic.topic_keywords as string[]).length && t.keywords.every(k => (topic.topic_keywords as string[]).includes(k))
              )
              if (existing) {
                existing.mention_count++
                existing.last_mentioned_at = new Date().toISOString()
                if (topic.emotion_state) existing.last_emotion_state = topic.emotion_state as string
              }
            }
            await db.saveTopics(existingTopics)
          }

          if (args.new_vocabulary && Array.isArray(args.new_vocabulary)) {
            for (const v of args.new_vocabulary as Array<{ word: string; mapped_emotion: string }>) {
              if (v.word && v.mapped_emotion) {
                profile.vocabulary_map[v.word] = v.mapped_emotion
              }
            }
            await db.saveProfile(profile)
          }

          if (args.growth_milestone) {
            const milestone = args.growth_milestone as Record<string, unknown>
            const milestoneMemory: db.Memory = {
              id: generateId(),
              content: milestone.description as string,
              category: 'milestone',
              emotion_tag: milestone.milestone_type as string,
              weight: 3,
              created_at: new Date().toISOString(),
            }
            await db.saveMemory(milestoneMemory)
          }

          if (args.suggested_action) {
            const action = args.suggested_action as Record<string, unknown>
            const actionLog: db.ActionLog = {
              id: generateId(),
              conversation_id: convId,
              action_description: action.description as string,
              emotion_context: action.emotion_context as string || undefined,
              status: 'suggested',
              created_at: new Date().toISOString(),
            }
            await db.saveActionLog(actionLog)
            yield { type: 'action_suggested', content: JSON.stringify(actionLog) }
          }

          if (args.structured_output) {
            const so = args.structured_output as Record<string, unknown>
            const output: db.GeneratedOutput = {
              id: generateId(),
              conversation_id: convId,
              output_type: so.output_type as string || 'draft',
              title: so.title as string || '未命名',
              content: so.content as string || '',
              status: 'draft',
              created_at: new Date().toISOString(),
            }
            await db.saveGeneratedOutput(output)
            yield { type: 'structured_output', content: JSON.stringify(output) }
          }

          if (args.wrap_up) {
            const wrap = args.wrap_up as { summary?: string; topic?: string }
            const sessionEnd = { summary: wrap.summary || '聊了一会儿', topic: wrap.topic || '' }
            yield { type: 'session_end', content: JSON.stringify(sessionEnd) }
            // 保存今日小结到 profile
            profile.today_summary = sessionEnd.summary
            await db.saveProfile(profile)
          }
          if (args.rumination_detected) {
            const rumination = args.rumination_detected as Record<string, unknown>
            if (rumination.detected) {
              yield { type: "rumination_hint", content: (rumination.pattern as string) || "" }
            }
          }
        }
      } else if (toolName === 'save_memory') {
        const input = args as any
        const memory: db.Memory = {
          id: generateId(),
          content: input.content || '',
          category: input.category || 'general',
          emotion_tag: input.emotion_tag,
          weight: input.weight || 1,
          created_at: new Date().toISOString(),
        }
        await db.saveMemory(memory)
      } else if (toolName === 'recall_memories') {
        const input = args as any
        const query = input?.query?.toLowerCase() || ''
        const all = await db.getMemories()
        const matched = all.filter(m =>
          !m.category.startsWith('milestone') &&
          (m.content.toLowerCase().includes(query) || m.emotion_tag?.toLowerCase().includes(query))
        ).slice(0, 3)
        if (matched.length > 0) {
          const recallText = matched.map(m =>
            `[${m.category}${m.emotion_tag ? `]（${m.emotion_tag}）` : ']'} ${m.content}（重要度：${m.weight}）`
          ).join('\n')
          allMessages.push({
            role: 'user',
            content: `[根据记忆检索结果补充上下文]\n${recallText}`,
          })
          yield { type: "recall", content: JSON.stringify({
            count: matched.length,
            topMatch: matched[0].content.slice(0, 60),
          })}
        }
      }
    }

    // 同一轮中提取文本回复（LLM 可能和 tool_use 一起返回 text）
    if (textBlock?.text) {
      finalResponse = textBlock.text
      yield { type: 'text', content: finalResponse! }
    }

    // 不管有没有工具调用，只要有文字回复就结束循环
    if (finalResponse) {
      // 只保留 API 需要的字段，清除内部字段
      if (content.length > 0) {
        const cleanContent = content.map((block: any) => {
          if (block.type === 'tool_use') {
            return { type: 'tool_use', id: block.id, name: block.name, input: block.input || {} }
          }
          return block
        })
        allMessages.push({ role: 'assistant', content: cleanContent })
      }
      break
    }

    // 只有工具调用但没文字回复时，追加指令让 LLM 直接回复
    if (toolUses.length > 0) {
      const contextHint = lastThinkContext
        ? `基于刚才的分析（核心洞察：${lastThinkContext}），请以情绪陪伴者的身份，用自然温暖的语言直接回复用户。不要调用任何工具。`
        : '请以情绪陪伴者的身份，用自然温暖的语言直接回复用户。不要调用任何工具。'
      allMessages.push({ role: 'user', content: contextHint })
    } else {
      break
    }
  }

  // --- 保存 AI 回复 ---
  if (finalResponse) {
    await db.addMessage(convId, {
      id: generateId(), role: 'assistant', content: finalResponse,
      created_at: new Date().toISOString(),
    })
  }

  // --- 更新对话预览 ---
  const updatedConvs = await db.getConversations()
  const updatedConv = updatedConvs.find(c => c.id === convId)
  if (updatedConv) {
    updatedConv.last_message = message
    await db.saveConversation(updatedConv)
  }

  // --- 滑动窗口摘要 ---
  // 滑动窗口摘要：每新增 20 条 user/assistant 消息生成一次摘要
  if (convId && finalResponse) {
    const allMsgs = await db.getMessages(convId)
    const summaryMsgs = allMsgs.filter(m => m.role === 'user' || m.role === 'assistant')
    const existingSummaries = await db.getConversationSummaries(convId)
    const lastSummarizedEnd = existingSummaries.length > 0
      ? Math.max(...existingSummaries.map(s => s.end_index))
      : -1
    const lastIndex = summaryMsgs.length - 1
    const cutoff = 20
    if (lastIndex - lastSummarizedEnd >= cutoff) {
      const startIdx = Math.max(0, lastSummarizedEnd + 1)
      const endIdx = Math.min(startIdx + 9, lastIndex)
      const toSummarize = summaryMsgs.slice(startIdx, endIdx + 1)
      if (toSummarize.length > 0) {
        const summaryText = toSummarize.map(m => `${m.role === 'user' ? '用户' : 'AI'}：${m.content.slice(0, 200)}`).join('\n')
        const firstMsgIndex = allMsgs.indexOf(toSummarize[0])
        const lastMsgIndex = allMsgs.indexOf(toSummarize[toSummarize.length - 1])
        const keyTopics = Array.from(new Set(
          toSummarize
            .flatMap(m => (m.content.match(/[一-龥]{2,4}/g) || []))
            .filter(w => !['什么', '怎么', '这样', '这个', '那个', '没有', '可以', '知道', '觉得', '时候', '一个', '自己', '因为', '所以'].includes(w))
            .slice(0, 10)
        ))
        const summary: db.ConversationSummary = {
          conversation_id: convId,
          summary: summaryText.slice(0, 500),
          key_topics: keyTopics,
          start_index: firstMsgIndex >= 0 ? firstMsgIndex : startIdx,
          end_index: lastMsgIndex >= 0 ? lastMsgIndex : endIdx,
          created_at: new Date().toISOString(),
        }
        await db.saveSummary(summary)
      }
    }
  }

  yield { type: 'done', content: JSON.stringify({ conversation_id: convId }) }
}

// ===== API 调用 =====

function getTools() {
  return [
    {
      name: 'think',
      description: '在回应用户前必须先调用，进行情绪分析和策略制定',
      input_schema: {
        type: 'object',
        properties: {
          analysis: { type: 'string', description: '对用户情绪和触发点的深度分析' },
          strategy: { type: 'string', description: '安抚策略和行动指南' },
          assess_previous_response: {
            type: 'object', description: '评估上一轮回复效果',
            properties: {
              quality_score: { type: 'integer', minimum: 1, maximum: 10 },
              was_effective: { type: 'boolean' },
              user_engagement: { type: 'string', enum: ['positive', 'negative', 'neutral'] },
              what_worked: { type: 'string' },
              what_could_improve: { type: 'string' },
              style_adjustment_suggestion: { type: 'string' },
              preference_observations: { type: 'array', items: { type: 'string' } },
            },
          },
          detected_topic: {
            type: 'object',
            properties: {
              is_new_topic: { type: 'boolean' },
              topic_keywords: { type: 'array', items: { type: 'string' } },
              emotion_state: { type: 'string' },
            },
          },
          new_vocabulary: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                word: { type: 'string' },
                mapped_emotion: { type: 'string' },
              },
            },
          },
          suggested_action: {
            type: 'object',
            properties: {
              description: { type: 'string', description: '推荐的具体微行动描述' },
              emotion_context: { type: 'string', description: '触发此行动的情绪上下文' },
            },
          },
          structured_output: {
            type: 'object',
            properties: {
              output_type: { type: 'string', enum: ['draft_reply', 'decision_card', 'journal', 'letter', 'emotion_card', 'conversation_export'], description: '产出类型' },
              title: { type: 'string', description: '产出标题' },
              content: { type: 'string', description: '产出内容' },
            },
          },
          wrap_up: {
            type: 'object',
            properties: {
              summary: { type: 'string', description: '今日对话的简短总结，不超过15字' },
              topic: { type: 'string', description: '今日核心话题关键词' },
            },
            description: '当对话自然结束时生成今日小结。检测信号：用户说了“好了/先这样/晚安/去忙了”或3轮以上无明显新话题',
          },
          growth_milestone: {
            type: "object",
            properties: {
              milestone_type: { type: "string", enum: ["self_discovery", "coping_success", "positive_shift", "pattern_break", "new_perspective"] },
              description: { type: "string" },
            },
          },
          rumination_detected: {
            type: "object",
            description: "检测到用户可能陷入反刍思维——反复纠结同一负面话题而无进展",
            properties: {
              detected: { type: "boolean" },
              pattern: { type: "string", description: "反刍的具体表现描述" },
            },
          },
        },
        required: ['analysis', 'strategy'],
      },
    },
    {
      name: 'save_memory',
      description: '发现用户的长期雷区、偏好、性格特征、有效应对方式时，保存为记忆',
      input_schema: {
        type: 'object',
        properties: {
          content: { type: 'string', description: '记忆内容' },
          category: { type: 'string', enum: ['trigger', 'preference', 'value', 'coping_strategy', 'personality', 'general'] },
          emotion_tag: { type: 'string' },
          weight: { type: 'integer', minimum: 1, maximum: 10 },
        },
        required: ['content'],
      },
    },
    {
      name: 'recall_memories',
      description: '检索与当前情绪或话题相关的历史记忆',
      input_schema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '需要检索的内容描述' },
        },
        required: ['query'],
      },
    },
  ]
}

async function callAPI(
  settings: { type: string; baseUrl: string; model: string },
  systemPrompt: string,
  messages: any[],
  tools: any[] | undefined,
  signal?: AbortSignal,
): Promise<{ content: any[] }> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 120000)
  const combinedSignal = signal ? anySignal(signal, controller.signal) : controller.signal

  try {
    if (settings.type === 'anthropic') {
      return await callAnthropic(settings, systemPrompt, messages, tools, combinedSignal)
    }
    return await callOpenAI(settings, systemPrompt, messages, tools, combinedSignal)
  } finally {
    clearTimeout(timeout)
  }
}

async function callAnthropic(
  settings: { baseUrl: string; model: string },
  systemPrompt: string,
  messages: any[],
  _tools: any[] | undefined,
  signal: AbortSignal,
): Promise<{ content: any[] }> {
  const key = await getApiKey(KEYS.ANTHROPIC_API_KEY)
  const baseUrl = settings.baseUrl.replace(/\/+$/, '')
  const url = baseUrl.includes('anthropic.com') ? `${baseUrl}/v1/messages` : `${baseUrl}/messages`

  const body: any = {
    model: settings.model,
    max_tokens: 4096,
    system: systemPrompt,
    messages: messages.map(m => ({
      role: m.role,
      content: Array.isArray(m.content) ? m.content : [{ type: 'text', text: m.content }],
    })),
    stream: true,
  }
  if (_tools && _tools.length > 0) {
    body.tools = _tools.map(t => ({
      name: t.name,
      description: t.description,
      input_schema: t.input_schema,
    }))
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key || '',
      'anthropic-version': '2023-06-01',
    },
    body: safeStringify(body),
    signal,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`ANTHROPIC_API_ERROR: ${response.status} ${text}`)
  }

  return parseAnthropicSSE(response)
}

async function callOpenAI(
  settings: { baseUrl: string; model: string },
  systemPrompt: string,
  messages: any[],
  _tools: any[] | undefined,
  signal: AbortSignal,
): Promise<{ content: any[] }> {
  const key = await getApiKey(KEYS.OPENAI_API_KEY) || await getApiKey(KEYS.ANTHROPIC_API_KEY)
  const baseUrl = settings.baseUrl.replace(/\/+$/, '')
  const url = baseUrl.includes('openai.com') ? `${baseUrl}/v1/chat/completions` : `${baseUrl}/chat/completions`

  const oaiMessages: any[] = [{ role: 'system', content: systemPrompt }]
  for (const m of messages) {
    // content 为数组时（含图片），转为 OpenAI image_url 格式
    let oaiContent = m.content
    if (Array.isArray(m.content)) {
      oaiContent = m.content.map((block: any) => {
        if (block.type === 'image' && block.source) {
          return {
            type: 'image_url',
            image_url: { url: `data:${block.source.media_type};base64,${block.source.data}` },
          }
        }
        return block
      })
    }
    oaiMessages.push({
      role: m.role,
      content: oaiContent,
    })
  }

  const body: any = {
    model: settings.model,
    max_tokens: 4096,
    messages: oaiMessages,
    stream: true,
    stream_options: { include_usage: true },
  }
  if (_tools && _tools.length > 0) {
    body.tools = _tools.map(t => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.input_schema,
      },
    }))
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: safeStringify(body),
    signal,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`API_ERROR: ${response.status} ${text}`)
  }

  return parseOpenAISSE(response)
}

async function parseAnthropicSSE(response: Response): Promise<{ content: any[] }> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('No response body')

  const decoder = new TextDecoder()
  let buffer = ''
  const contentBlocks: any[] = []
  let currentBlock: any = null

  while (true) {
    let readResult
    try {
      readResult = await reader.read()
    } catch (err) {
      // Stream aborted — return what we have
      break
    }
    const { done, value } = readResult
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = JSON.parse(line.slice(6))
      const eventType = data.type

      if (eventType === 'content_block_start') {
        currentBlock = { type: data.content_block.type }
        if (data.content_block.type === 'text') {
          currentBlock.text = data.content_block.text || ''
        } else if (data.content_block.type === 'tool_use') {
          currentBlock.name = data.content_block.name
          currentBlock.id = data.content_block.id
          currentBlock.input = ''
        }
        contentBlocks.push(currentBlock)
      } else if (eventType === 'content_block_delta') {
        if (data.delta.type === 'text_delta') {
          currentBlock.text = (currentBlock.text || '') + data.delta.text
        } else if (data.delta.type === 'input_json_delta') {
          currentBlock._jsonBuffer = (currentBlock._jsonBuffer || '') + data.delta.partial_json
          // Try to parse
          try {
            currentBlock.input = JSON.parse(currentBlock._jsonBuffer)
          } catch {}
        }
      } else if (eventType === 'content_block_stop') {
        if (currentBlock?.type === 'tool_use') {
          if (currentBlock._jsonBuffer) {
            try { currentBlock.input = JSON.parse(currentBlock._jsonBuffer) } catch {}
          }
          delete currentBlock._jsonBuffer
        }
        currentBlock = null
      }
    }
  }

  // Final parse for any incomplete tool_use blocks
  for (const block of contentBlocks) {
    if (block.type === 'tool_use') {
      if (block._jsonBuffer) {
        try { block.input = JSON.parse(block._jsonBuffer) } catch {}
        delete block._jsonBuffer
      }
      if (typeof block.input === 'string') {
        try { block.input = JSON.parse(block.input) } catch { block.input = {} }
      }
    }
  }

  return { content: contentBlocks }
}

async function parseOpenAISSE(response: Response): Promise<{ content: any[] }> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('No response body')

  const decoder = new TextDecoder()
  let buffer = ''
  const contentBlocks: any[] = []
  let currentToolCall: any = null

  while (true) {
    let readResult
    try {
      readResult = await reader.read()
    } catch (err) {
      // Stream aborted — return what we have
      break
    }
    const { done, value } = readResult
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const dataStr = line.slice(6).trim()
      if (dataStr === '[DONE]') continue

      const data = JSON.parse(dataStr)
      const delta = data.choices?.[0]?.delta || {}

      // Text content
      if (delta.content) {
        let textBlock = contentBlocks.find(b => b.type === 'text')
        if (!textBlock) {
          textBlock = { type: 'text', text: '' }
          contentBlocks.push(textBlock)
        }
        textBlock.text += delta.content
      }

      // Tool calls
      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          if (tc.function?.name) {
            currentToolCall = {
              type: 'tool_use',
              name: tc.function.name,
              id: tc.id,
              input: '',
              _jsonBuffer: '',
            }
            contentBlocks.push(currentToolCall)
          }
          if (tc.function?.arguments && currentToolCall) {
            currentToolCall._jsonBuffer += tc.function.arguments
            try {
              currentToolCall.input = JSON.parse(currentToolCall._jsonBuffer)
            } catch {}
          }
        }
      }
    }
  }

  for (const block of contentBlocks) {
    if (block._jsonBuffer !== undefined) {
      if (block._jsonBuffer) {
        try { block.input = JSON.parse(block._jsonBuffer) } catch { block.input = {} }
      }
      delete block._jsonBuffer
    }
  }

  return { content: contentBlocks }
}

function anySignal(...signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController()
  for (const sig of signals) {
    if (sig.aborted) { controller.abort(); break }
    const handler = () => controller.abort()
    sig.addEventListener('abort', handler)
    controller.signal.addEventListener('abort', () => sig.removeEventListener('abort', handler), { once: true })
  }
  return controller.signal
}

// 安全 JSON 序列化，避免循环引用导致 Maximum call stack size exceeded
function safeStringify(obj: any): string {
  const seen = new WeakSet()
  return JSON.stringify(obj, (_, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) return '[Circular]'
      seen.add(value)
    }
    return value
  })
}

function getTimePeriod(): string {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 18) return 'afternoon'
  if (hour >= 18 && hour < 23) return 'evening'
  return 'night'
}

function getLearningStage(count: number): string {
  if (count <= 3) return 'cold_start'
  if (count <= 20) return 'calibration'
  return 'deep_tuning'
}
