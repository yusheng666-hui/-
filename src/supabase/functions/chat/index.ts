// 雨声 — 聊天 Edge Function
// 运行时：Deno (Supabase Edge Functions)
// 职责：信号检测 → 偏好更新 → 记忆检索 → LLM 调用 → 工具处理 → 流式返回

import { createClient } from 'npm:@supabase/supabase-js'
import { detectSignals, detectExplicitPreference } from './signal-detector.ts'
import { updatePreferences, createDefaultPreferences, applyExplicitPreference, type PreferenceDimension } from './preference-updater.ts'
import { buildSystemPrompt, type PromptContext } from './prompt-builder.ts'

// --- CORS ---
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-api-key, x-embedding-api-key, x-time-period, x-focus-mode, x-share-source',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// --- Anthropic API ---
const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'
const MODEL = 'claude-sonnet-4-20250514'

// --- Voyage API ---
const VOYAGE_API = 'https://api.voyageai.com/v1/embeddings'
const VOYAGE_MODEL = 'voyage-3-lite'

// --- 工具定义 ---
const TOOLS = [
  {
    name: 'think',
    description: '在回应用户前必须先调用，进行情绪分析和策略制定。如果是后续消息（非首条），必须同时评估上一轮回复的效果。',
    input_schema: {
      type: 'object',
      properties: {
        analysis: { type: 'string', description: '对用户情绪和触发点的深度分析' },
        strategy: { type: 'string', description: '安抚策略和行动指南' },
        assess_previous_response: {
          type: 'object',
          description: '评估上一轮回复效果，首条消息不填',
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
            topic_keywords: { type: 'array', items: { type: 'string' } },
            is_new_topic: { type: 'boolean' },
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
        detected_growth: {
          type: 'object',
          properties: {
            milestone_type: {
              type: 'string',
              enum: ['pattern_break', 'new_perspective', 'self_discovery', 'coping_success', 'positive_shift'],
            },
            description: { type: 'string' },
          },
        },
        rumination_detected: {
          type: 'object',
          properties: {
            topic: { type: 'string' },
            occurrence_count: { type: 'integer' },
            suggested_action: { type: 'string', enum: ['redirect', 'deep_dive'] },
          },
        },
        suggested_action: {
          type: 'object',
          properties: {
            description: { type: 'string' },
            category: { type: 'string', enum: ['physical', 'mental', 'social', 'creative'] },
          },
        },
        recall_trigger: {
          type: 'object',
          properties: {
            target_date: { type: 'string' },
            event_summary: { type: 'string' },
          },
        },
        structured_output: {
          type: 'object',
          properties: {
            output_type: {
              type: 'string',
              enum: ['reply_draft', 'decision_card', 'diary_draft', 'thank_letter', 'apology_letter', 'emotion_card'],
            },
            title: { type: 'string' },
            content: { type: 'string' },
            format: { type: 'string', enum: ['markdown', 'text', 'card'] },
          },
        },
      },
      required: ['analysis', 'strategy'],
    },
  },
  {
    name: 'save_memory',
    description: '发现用户的长期偏好、雷区、性格特征或有效应对方式时调用，记录到灵魂记忆库',
    input_schema: {
      type: 'object',
      properties: {
        memory_content: { type: 'string', description: '提炼的记忆内容，如"对迟到极度敏感"' },
        category: {
          type: 'string',
          enum: ['trigger', 'preference', 'value', 'coping', 'trait'],
          description: '分类：trigger=触发源, preference=偏好, value=价值观, coping=应对方式, trait=性格特征',
        },
        emotion_tag: { type: 'string', description: '关联情绪标签，如"焦虑"' },
      },
      required: ['memory_content', 'category', 'emotion_tag'],
    },
  },
  {
    name: 'recall_memories',
    description: '当需要回顾更多相关记忆以更好理解当前情绪时调用，检索灵魂记忆库',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '检索关键词，如"关于工作的焦虑"' },
      },
      required: ['query'],
    },
  },
]

// ============================================================
// 主入口
// ============================================================

serve(async (req: Request) => {
  // 预检请求
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // 创建 SSE 流
  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()
  const encoder = new TextEncoder()

  // 异步处理（不阻塞 response 返回）
  processRequest(req, writer, encoder).catch(err => {
    console.error('Fatal error:', err)
    writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'error', content: '服务器内部错误' })}\n\n`))
    writer.close()
  })

  return new Response(readable, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Content-Type-Options': 'nosniff',
    },
  })
})

// ============================================================
// 请求处理主逻辑
// ============================================================

interface ChatRequest {
  message: string
  conversation_id?: string
  mode?: 'chat' | 'journal' | 'low_power' | 'emergency'
  personality?: string
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string | Array<{ type: string; [key: string]: unknown }>
}

// --- 简单速率限制 (内存滑动窗口) ---
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = { maxRequests: 30, windowMs: 60000 }

function checkRateLimit(userId: string): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const entry = rateLimitMap.get(userId)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT.windowMs })
    return { allowed: true, remaining: RATE_LIMIT.maxRequests - 1 }
  }
  entry.count++
  return { allowed: entry.count <= RATE_LIMIT.maxRequests, remaining: Math.max(0, RATE_LIMIT.maxRequests - entry.count) }
}

async function processRequest(
  req: Request,
  writer: WritableStreamDefaultWriter,
  encoder: TextEncoder,
): Promise<void> {
  let errConvId: string | undefined
  try {
    // --- 解析请求 ---
    const body: ChatRequest = await req.json()
    const { message, conversation_id, mode = 'chat', personality } = body

    // --- 提取 Header 中的 Key 和上下文 ---
    const anthropicKey = req.headers.get('x-user-api-key') || ''
    const voyageKey = req.headers.get('x-embedding-api-key') || ''
    const timePeriod = req.headers.get('x-time-period') || 'day'
    const focusMode = req.headers.get('x-focus-mode') || 'none'

    if (!anthropicKey) {
      throw new Error('MISSING_API_KEY')
    }

    // --- 初始化 Supabase 客户端 ---
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // --- 获取/创建用户 (暂时使用匿名ID, 后期接入 auth) ---
    const userId = body.conversation_id ? await getUserIdFromConversation(supabase, body.conversation_id) : null
    // 简化：使用固定测试用户 ID。生产环境需接入 Supabase Auth
    const effectiveUserId = userId || '00000000-0000-0000-0000-000000000001'

    // --- 确保 profiles 存在 ---
    await ensureProfile(supabase, effectiveUserId)

    // --- 速率限制检查 ---
    const { allowed, remaining } = checkRateLimit(effectiveUserId)
    if (!allowed) {
      throw new Error('RATE_LIMITED')
    }

    // ========================
    // 模式检查
    // ========================

    // 日志模式：跳过 LLM，仅 embedding + 记忆入库
    if (mode === 'journal') {
      await handleJournalMode(supabase, writer, encoder, effectiveUserId, message, voyageKey, conversation_id)
      return
    }

    // 低电量模式：检查当日轮次上限（跨对话累计）
    if (mode === 'low_power') {
      const today = new Date().toISOString().split('T')[0]
      const { data: todayConvs } = await supabase
        .from('conversations')
        .select('current_round')
        .eq('user_id', effectiveUserId)
        .eq('mode', 'low_power')
        .gte('created_at', today)

      const totalRounds = (todayConvs || []).reduce((sum, c) => sum + (c.current_round || 0), 0)
      if (totalRounds >= 3) {
        await sendSSE(writer, encoder, 'text', '今日份交流已到上限，不累了就早点休息吧 🌙')
        await sendSSE(writer, encoder, 'done', '')
        return
      }
    }

    // ========================
    // 1. 信号检测（非急救模式）
    // ========================
    // 计算上一轮 AI 回复长度（用于信号上下文）
    const prevAssistant = allMessages.filter(m => m.role === 'assistant').pop()
    const prevResponseLength = typeof prevAssistant?.content === 'string' ? prevAssistant.content.length : undefined
    let signals = detectSignals(message, prevResponseLength)
    if (mode === 'emergency') {
      signals = [] // 急救模式不触发信号检测
    }

    // ========================
    // 2. 偏好更新（非急救模式）
    // ========================
    if (mode !== 'emergency' && mode !== 'low_power' && signals.length > 0) {
      const { data: existingPrefsRaw } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', effectiveUserId)

      existingPrefsHoist = existingPrefsRaw
      let prefs: PreferenceDimension[]
      if (existingPrefsRaw && existingPrefsRaw.length > 0) {
        prefs = existingPrefs.map(p => ({
          dimension: p.dimension,
          value: p.value,
          confidence: p.confidence,
          sample_count: p.sample_count,
          history: p.history || [],
        }))
      } else {
        prefs = createDefaultPreferences()
      }

      const updates = updatePreferences(signals, prefs)

      // 异步写库
      if (updates.length > 0) {
        for (const update of updates) {
          await supabase.from('user_preferences').upsert({
            user_id: effectiveUserId,
            dimension: update.dimension,
            value: update.new_value,
            confidence: update.new_confidence,
            sample_count: (prefs.find((p: any) => p.dimension === update.dimension)?.sample_count || 0) + 1,
            history: [
              ...(prefs.find((p: any) => p.dimension === update.dimension)?.history || []),
              { value: update.new_value, confidence: update.new_confidence, timestamp: new Date().toISOString() },
            ],
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id, dimension' })
        }
      }

      // 写信号日志
      for (const sig of signals) {
        await supabase.from('engagement_signals').insert({
          user_id: effectiveUserId,
          signal_type: sig.signal_type,
          signal_key: sig.signal_key,
          confidence: sig.confidence,
          detection_layer: 'regex',
          context: sig.context,
        }).maybeSingle()
      }
    }

    // ========================
    // 3. 加载上下文
    // ========================

    // 复用已加载的偏好（避免重复查询）
    const preferences = (existingPrefsHoist && existingPrefsHoist.length > 0)
      ? existingPrefsHoist.map((p: any) => ({ dimension: p.dimension, value: p.value, confidence: p.confidence }))
      : createDefaultPreferences()

    // 加载 profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', effectiveUserId)
      .single()

    // Cold start: 检测明确表述的偏好
    if (profile?.learning_stage === 'cold_start') {
      const explicitPref = detectExplicitPreference(message)
      if (explicitPref && existingPrefsHoist && existingPrefsHoist.length > 0) {
        const matched = existingPrefsHoist.find((p: any) => p.dimension === explicitPref.dimension)
        if (matched) {
          const current: PreferenceDimension = {
            dimension: matched.dimension,
            value: matched.value,
            confidence: matched.confidence,
            sample_count: 0,
            history: [],
          }
          const update = applyExplicitPreference(current, explicitPref.value)
          await supabase.from('user_preferences').upsert({
            user_id: effectiveUserId,
            dimension: update.dimension,
            value: update.new_value,
            confidence: update.new_confidence,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id, dimension' })
        }
      }
    }

    // 加载相关记忆
    const memoryEmbedding = voyageKey ? await generateEmbedding(voyageKey, message) : null
    let memories: PromptContext['memories'] = []
    if (memoryEmbedding) {
      const { data: memData } = await supabase.rpc('match_memories', {
        p_user_id: effectiveUserId,
        p_embedding: memoryEmbedding,
        p_match_threshold: 0.5,
        p_match_count: 3,
      })
      if (memData) {
        memories = memData.map((m: any) => ({
          content: m.content,
          weight: m.weight,
          emotion_tag: m.emotion_tag,
          category: m.category,
        }))
        // 更新访问时间 + 权重递增
        for (const m of memData) {
          await supabase.from('memories').update({
            last_accessed_at: new Date().toISOString(),
            weight: (m.weight || 1) + 1,
          }).eq('id', m.id)
        }
      }
    }

    // 加载活跃话题
    const { data: topics } = await supabase
      .from('topics')
      .select('keywords, last_emotion_state, mention_count')
      .eq('user_id', effectiveUserId)
      .eq('is_active', true)

    // 加载自定义动作
    const { data: actions } = await supabase
      .from('custom_actions')
      .select('trigger_emotion, action_description, effectiveness_score')
      .eq('user_id', effectiveUserId)
      .eq('is_active', true)

    // 加载上轮自评（从最近的 thought 消息中提取）
    let previousAssessment: string | undefined
    if (conversation_id) {
      const { data: lastThought } = await supabase
        .from('messages')
        .select('content')
        .eq('conversation_id', conversation_id)
        .eq('role', 'thought')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (lastThought?.content) {
        const marker = '**上轮回复自评**：'
        const idx = lastThought.content.indexOf(marker)
        if (idx > -1) {
          previousAssessment = lastThought.content.slice(idx + marker.length).trim()
        }
      }
    }

    // ========================
    // 4. 构建 System Prompt
    // ========================

    const promptCtx: PromptContext = {
      learning_stage: profile?.learning_stage || 'cold_start',
      interaction_count: profile?.interaction_count || 0,
      time_period: timePeriod,
      focus_mode: focusMode,
      preferences,
      personality_prompt: profile?.personality_prompt || '',
      current_personality: personality || profile?.current_personality || 'tree_hole',
      vocabulary_map: (profile?.vocabulary_map as Record<string, string>) || {},
      active_topics: (topics || []).map(t => ({
        keywords: t.keywords,
        last_emotion_state: t.last_emotion_state,
        mention_count: t.mention_count,
      })),
      memories,
      custom_actions: (actions || []).map(a => ({
        trigger_emotion: a.trigger_emotion,
        action_description: a.action_description,
        effectiveness_score: a.effectiveness_score,
      })),
      mode,
      previous_assessment: previousAssessment,
    }

    const systemPrompt = buildSystemPrompt(promptCtx)

    // ========================
    // 5. 加载对话历史
    // ========================

    const historyMessages: ChatMessage[] = []
    if (conversation_id) {
      const { data: msgs } = await supabase
        .from('messages')
        .select('role, content')
        .eq('conversation_id', conversation_id)
        .in('role', ['user', 'assistant'])
        .order('created_at', { ascending: true })
        .limit(20)

      if (msgs) {
        for (const m of msgs.slice(-20)) {
          historyMessages.push({ role: m.role, content: m.content })
        }
      }
    }

    // ========================
    // 6. LLM 调用（多轮工具循环）
    // ========================

    const allMessages: ChatMessage[] = [
      ...historyMessages,
      { role: 'user', content: message },
    ]

    // 获取或创建对话
    let convId = conversation_id
    if (!convId) {
      const { data: conv } = await supabase.from('conversations').insert({
        user_id: effectiveUserId,
        mode,
        round_limit: mode === 'low_power' ? 3 : null,
      }).select('id').single()
      convId = conv?.id
    }
    errConvId = convId

    // 保存用户消息
    const { data: userMsg } = await supabase.from('messages').insert({
      conversation_id: convId,
      role: 'user',
      content: message,
    }).select('id').single()
    errUserMsgId = userMsg?.id

    // 更新对话轮次
    if (convId) {
      await supabase.rpc('increment_conversation_round', { conv_id: convId })
    }

    // 更新 interaction_count
    await supabase.from('profiles').update({
      interaction_count: (profile?.interaction_count || 0) + 1,
      learning_stage: getLearningStage((profile?.interaction_count || 0) + 1),
    }).eq('id', effectiveUserId)

    // --- LLM 工具循环 ---
    let finalResponse = ''
    let currentMessages: ChatMessage[] = [...allMessages]

    // 最多 3 轮工具调用
    for (let turn = 0; turn < 3; turn++) {
      // 流式调用 Anthropic API（stream: true）
      const result = await callAnthropicStreaming(anthropicKey, systemPrompt, currentMessages, writer, encoder)
      const content = result.content

      // 检查是否有 tool_use
      const toolUses = content.filter((block) => block.type === 'tool_use')

      // 将完整的 assistant 内容（含 tool_use blocks）加入历史
      if (content.length > 0) {
        currentMessages.push({ role: 'assistant', content })
      }

      if (toolUses.length === 0) {
        // 纯文本回复
        const textBlock = content.find((block) => block.type === 'text')
        finalResponse = textBlock?.text as string || ''
        if (finalResponse) {
          await sendSSE(writer, encoder, 'text', finalResponse)
        }
        break
      }

      // --- 处理工具调用 ---
      for (const tool of toolUses) {
        const toolName = tool.name as string
        const args = tool.input as Record<string, unknown> || {}
        const toolId = tool.id as string

        if (toolName === 'think') {
          // 流式推送思考内容到前端
          if (args.analysis || args.strategy) {
            const thoughtContent = [
              args.analysis ? `**分析**：${args.analysis}` : '',
              args.strategy ? `**策略**：${args.strategy}` : '',
            ].filter(Boolean).join('\n\n')

            await sendSSE(writer, encoder, 'thought', thoughtContent)

            // 处理自评
            if (args.assess_previous_response) {
              const assess = args.assess_previous_response as Record<string, unknown>
              await sendSSE(writer, encoder, 'assessment', JSON.stringify(assess))

              // 将自评文本追加到 thoughtContent（后续存入 DB）
              const assessLines = [
                `质量评分：${assess.quality_score}/10`,
                assess.was_effective !== undefined ? `是否有效：${assess.was_effective ? '是' : '否'}` : '',
                assess.user_engagement ? `用户参与度：${assess.user_engagement}` : '',
                assess.what_worked ? `有效点：${assess.what_worked}` : '',
                assess.what_could_improve ? `可改进：${assess.what_could_improve}` : '',
                assess.style_adjustment_suggestion ? `风格调整建议：${assess.style_adjustment_suggestion}` : '',
              ].filter(Boolean).join('\n')
              thoughtContent += `\n\n**上轮回复自评**：\n${assessLines}`

              if (convId) {
                const { data: lastAssistant } = await supabase
                  .from('messages')
                  .select('id')
                  .eq('conversation_id', convId)
                  .eq('role', 'assistant')
                  .order('created_at', { ascending: false })
                  .limit(1)
                  .maybeSingle()

                if (lastAssistant) {
                  await supabase.from('messages').update({
                    quality_score: assess.quality_score as number,
                  }).eq('id', lastAssistant.id)
                }
              }
            }

            // 保存 thought 消息到 DB（此时已包含自评文本）
            if (convId) {
              await supabase.from('messages').insert({
                conversation_id: convId,
                role: 'thought',
                content: thoughtContent,
              }).maybeSingle()
            }

            // 处理话题检测
            if (args.detected_topic) {
              const topic = args.detected_topic as Record<string, unknown>
              if (topic.is_new_topic) {
                await supabase.from('topics').insert({
                  user_id: effectiveUserId,
                  keywords: topic.topic_keywords,
                  last_emotion_state: topic.emotion_state,
                }).maybeSingle()
              } else {
                // RPC 递增 mention_count + last_mentioned_at（exact match）
                await supabase.rpc('increment_mention_count', {
                  topic_keywords: topic.topic_keywords,
                })
                // 单独更新 emotion_state，使用相同的 exact match
                if (topic.emotion_state) {
                  await supabase.from('topics')
                    .update({ last_emotion_state: topic.emotion_state })
                    .eq('user_id', effectiveUserId)
                    .eq('keywords', topic.topic_keywords as string[])
                }
              }
            }

            // 处理新词汇
            if (args.new_vocabulary && Array.isArray(args.new_vocabulary)) {
              const vocabMap = (profile?.vocabulary_map as Record<string, string>) || {}
              for (const v of args.new_vocabulary as Array<{ word: string; mapped_emotion: string }>) {
                if (v.word && v.mapped_emotion) {
                  vocabMap[v.word] = v.mapped_emotion
                }
              }
              await supabase.from('profiles').update({ vocabulary_map: vocabMap }).eq('id', effectiveUserId)
            }

            // 处理成长里程碑
            if (args.detected_growth) {
              const growth = args.detected_growth as Record<string, string>
              await supabase.from('growth_milestones').insert({
                user_id: effectiveUserId,
                milestone_type: growth.milestone_type,
                description: growth.description,
                source_message_id: userMsg?.id,
              }).maybeSingle()
            }

            // 处理微行动建议
            if (args.suggested_action) {
              const action = args.suggested_action as Record<string, string>
              await supabase.from('action_logs').insert({
                user_id: effectiveUserId,
                message_id: userMsg?.id,
                action_description: action.description,
              }).maybeSingle()

              await sendSSE(writer, encoder, 'action_suggested', JSON.stringify({
                description: action.description,
                category: action.category,
              }))
            }

            // 处理结构化产出
            if (args.structured_output) {
              const so = args.structured_output as Record<string, string>
              await supabase.from('generated_outputs').insert({
                user_id: effectiveUserId,
                output_type: so.output_type,
                title: so.title,
                content: so.content,
                source_message_id: userMsg?.id,
              }).maybeSingle()

              await sendSSE(writer, encoder, 'structured_output', JSON.stringify({
                output_type: so.output_type,
                title: so.title,
                content: so.content,
                format: so.format,
              }))
            }
          }

          // tool 结果（think 不需要返回额外数据给模型）
          currentMessages.push({
            role: 'user',
            content: [{
              type: 'tool_result',
              tool_use_id: toolId,
              content: '分析完成，请基于以上分析回复用户。',
            }],
          })
        } else if (toolName === 'save_memory') {
          // 生成 embedding
          let embedding: number[] | null = null
          if (voyageKey) {
            embedding = await generateEmbedding(voyageKey, args.memory_content as string)
          }

          // 写入 memories 表
          await supabase.from('memories').insert({
            user_id: effectiveUserId,
            content: args.memory_content as string,
            category: (args.category as string) || 'preference',
            emotion_tag: (args.emotion_tag as string) || null,
            embedding: embedding ? JSON.stringify(embedding) : null,
          }).maybeSingle()

          // tool 结果
          currentMessages.push({
            role: 'user',
            content: [{
              type: 'tool_result',
              tool_use_id: toolId,
              content: `已记录"${args.memory_content || ''}"`,
            }],
          })
        } else if (toolName === 'recall_memories') {
          // 向量检索
          let recalledMemories: Array<{ content: string; weight: number; emotion_tag: string | null; category: string }> = []
          const query = (args.query as string) || message
          const queryEmbedding = voyageKey ? await generateEmbedding(voyageKey, query) : null
          if (queryEmbedding) {
            const { data: memData } = await supabase.rpc('match_memories', {
              p_user_id: effectiveUserId,
              p_embedding: queryEmbedding,
              p_match_threshold: 0.5,
              p_match_count: 5,
            })
            if (memData) {
              recalledMemories = memData.map((m: any) => ({
                content: m.content,
                weight: m.weight,
                emotion_tag: m.emotion_tag,
                category: m.category,
              }))
            }
          }

          const memText = recalledMemories.length > 0
            ? recalledMemories.map(m => `[${m.category}${m.emotion_tag ? `]（${m.emotion_tag}）` : ']'} ${m.content}（重要度：${m.weight}）`).join('\n')
            : '未找到相关记忆。'

          currentMessages.push({
            role: 'user',
            content: [{
              type: 'tool_result',
              tool_use_id: toolId,
              content: memText,
            }],
          })
        }
      }
    }

    // ========================
    // 7. 最终文本回复流式输出
    // ========================

    if (finalResponse) {
      // 文本已在 LLM 流式调用中发送给前端，只需保存到 DB

      // 保存到 DB
      if (convId) {
        await supabase.from('messages').insert({
          conversation_id: convId,
          role: 'assistant',
          content: finalResponse,
        }).maybeSingle()
      }
    }

    // ========================
    // 8. 完成
    // ========================

    await sendSSE(writer, encoder, 'done', JSON.stringify({ conversation_id: convId }))
    writer.close()

    // 非阻塞生成洞察
    generateInsights(supabase, effectiveUserId, (profile?.interaction_count || 0) + 1).catch(() => {})

  } catch (err) {
        // 清理因 LLM 失败产生的孤立用户消息
    if (errUserMsgId) {
      try { await supabase.from('messages').delete().eq('id', errUserMsgId).maybeSingle() } catch {}
    }
  const errorMessage = err instanceof Error ? err.message : 'UNKNOWN_ERROR'

    if (errorMessage === 'MISSING_API_KEY') {
      await sendSSE(writer, encoder, 'error', '请先在设置中配置 API Key')
    } else if (errorMessage === 'RATE_LIMITED') {
      await sendSSE(writer, encoder, 'error', '请求过于频繁，请稍后再试')
    } else if (errorMessage.startsWith('ANTHROPIC_API_ERROR')) {
      await sendSSE(writer, encoder, 'error', 'AI 服务暂时不可用，请检查 API Key 是否正确')
    } else {
      console.error('processRequest error:', err)
      await sendSSE(writer, encoder, 'error', '处理请求时出错，请重试')
    }

    await sendSSE(writer, encoder, 'done', JSON.stringify({ conversation_id: errConvId }))
    writer.close()
  }
}

// ============================================================
// 辅助函数
// ============================================================

function serve(handler: (req: Request) => Response | Promise<Response>): void {
  Deno.serve(handler)
}

async function sendSSE(
  writer: WritableStreamDefaultWriter,
  encoder: TextEncoder,
  type: string,
  content: string,
): Promise<void> {
  const data = JSON.stringify({ type, content })
  await writer.write(encoder.encode(`data: ${data}\n\n`))
}

async function generateEmbedding(apiKey: string, text: string): Promise<number[] | null> {
  try {
    const response = await fetch(VOYAGE_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: VOYAGE_MODEL,
        input: [text],
        input_type: 'document',
        truncation: true,
      }),
    })

    if (!response.ok) {
      console.error('Voyage API error:', response.status)
      return null
    }

    const data = await response.json()
    return data.data?.[0]?.embedding || null
  } catch (err) {
    console.error('Embedding error:', err)
    return null
  }
}

async function ensureProfile(supabase: any, userId: string): Promise<void> {
  const { data } = await supabase.from('profiles').select('id').eq('id', userId).maybeSingle()
  if (!data) {
    await supabase.from('profiles').insert({
      id: userId,
      learning_stage: 'cold_start',
      interaction_count: 0,
    }).maybeSingle()
  }
}

async function getUserIdFromConversation(supabase: any, conversationId: string): Promise<string | null> {
  const { data } = await supabase
    .from('conversations')
    .select('user_id')
    .eq('id', conversationId)
    .maybeSingle()
  return data?.user_id || null
}

function getLearningStage(count: number): string {
  if (count <= 3) return 'cold_start'
  if (count <= 20) return 'calibration'
  return 'deep_tuning'
}

/**
 * 流式调用 Anthropic API，转发 text delta 到前端，返回完整 content blocks。
 * 在工具调用轮次中，文本被缓冲后丢弃；在纯文本轮次中，文本逐块发送给前端。
 */
async function callAnthropicStreaming(
  anthropicKey: string,
  systemPrompt: string,
  messages: ChatMessage[],
  writer: WritableStreamDefaultWriter,
  encoder: TextEncoder,
): Promise<{ content: Array<Record<string, unknown>> }> {
  const response = await fetch(ANTHROPIC_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicKey,
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 8192,
      system: systemPrompt,
      messages,
      tools: TOOLS,
      stream: true,
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`ANTHROPIC_API_ERROR: ${response.status}`)
  }

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  const content: Array<Record<string, unknown>> = []
  let currentBlock: Record<string, unknown> | null = null
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const dataStr = line.slice(6).trim()
        if (!dataStr || dataStr === '[DONE]') continue

        try {
          const event = JSON.parse(dataStr)

          switch (event.type) {
            case 'content_block_start': {
              const block = event.content_block || {}
              currentBlock = { ...block }
              content.push(currentBlock)
              if (block.type === 'tool_use' && !block.input) {
                currentBlock.input = {}
              }
              break
            }

            case 'content_block_delta': {
              const delta = event.delta || {}
              if (delta.type === 'text_delta' && currentBlock) {
                const tb = currentBlock as any
                tb.text = (tb.text || '') + delta.text
              }
              if (delta.type === 'input_json_delta' && currentBlock) {
                const tb = currentBlock as any
                tb._jsonBuffer = (tb._jsonBuffer || '') + delta.partial_json
              }
              break
            }

            case 'content_block_stop': {
              if (currentBlock?.type === 'tool_use') {
                const tb = currentBlock as any
                if (tb._jsonBuffer) {
                  try { tb.input = JSON.parse(tb._jsonBuffer) } catch {}
                  delete tb._jsonBuffer
                }
              }
              currentBlock = null
              break
            }
          }
        } catch { /* skip malformed events */ }
      }
    }
  } finally {
    reader.releaseLock()
  }

  return { content }
}


/**
 * 生成情绪洞察：基于最近的信号和里程碑创建洞察记录。
 * 每 10 次交互自动生成一次 daily 洞察。
 */
async function generateInsights(
  supabase: any,
  userId: string,
  interactionCount: number,
): Promise<void> {
  // 每 10 次交互生成一次洞察
  if (interactionCount % 10 !== 0) return
  const today = new Date().toISOString().split('T')[0]

  // 检查今天是否已生成过洞察
  const { data: existing } = await supabase
    .from('emotional_insights')
    .select('id')
    .eq('user_id', userId)
    .eq('period', 'daily')
    .gte('generated_at', today)
    .limit(1)

  if (existing && existing.length > 0) return

  // 获取近期的信号摘要
  const { data: recentSignals } = await supabase
    .from('engagement_signals')
    .select('signal_type')
    .eq('user_id', userId)
    .gte('created_at', today)

  // 获取成长里程碑
  const { data: recentMilestones } = await supabase
    .from('growth_milestones')
    .select('milestone_type, description')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(5)

  const positiveCount = (recentSignals || []).filter(s => s.signal_type === 'positive').length
  const negativeCount = (recentSignals || []).filter(s => s.signal_type === 'negative').length
  const milestoneCount = (recentMilestones || []).length

  const summary = `今日互动 ${interactionCount} 次。`
    + `积极信号 ${positiveCount} 次，消极信号 ${negativeCount} 次。`
    + (milestoneCount > 0 ? `记录了 ${milestoneCount} 个成长里程碑。` : '')

  const patterns = (recentMilestones || []).map(m => ({
    pattern: m.milestone_type,
    count: 1,
    confidence: 0.6,
  }))

  await supabase.from('emotional_insights').insert({
    user_id: userId,
    period: 'daily',
    summary,
    patterns_detected: patterns.length > 0 ? patterns : [],
  }).maybeSingle()
}
async function handleJournalMode(
  supabase: any,
  writer: WritableStreamDefaultWriter,
  encoder: TextEncoder,
  userId: string,
  message: string,
  voyageKey: string,
  conversationId?: string,
): Promise<void> {
  // 日志模式：只存不入 LLM
  let convId = conversationId
  if (!convId) {
    const { data: conv } = await supabase.from('conversations').insert({
      user_id: userId,
      mode: 'journal',
    }).select('id').single()
    convId = conv?.id
  }

  // 生成 embedding
  let embedding: number[] | null = null
  if (voyageKey) {
    embedding = await generateEmbedding(voyageKey, message)
  }

  // 存入 memories
  await supabase.from('memories').insert({
    user_id: userId,
    content: message,
    category: 'value',
    embedding: embedding ? JSON.stringify(embedding) : null,
  }).maybeSingle()

  // 记录为 journal 消息
  await supabase.from('messages').insert({
    conversation_id: convId,
    role: 'journal',
    content: message,
  }).maybeSingle()

  await sendSSE(writer, encoder, 'done', JSON.stringify({ conversation_id: convId }))
  writer.close()
}
