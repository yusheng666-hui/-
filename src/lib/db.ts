// 本地数据库 — 所有用户数据存储在 AsyncStorage
// 与 API Key 完全解耦：换 Key 不影响数据

import AsyncStorage from '@react-native-async-storage/async-storage'

import { safeJsonParse, generateId } from './utils'

export type Message = {
  id: string
  role: 'user' | 'assistant' | 'thought'
  content: string
  quality_score?: number
  created_at: string
}

export type Conversation = {
  id: string
  mode: string
  current_round: number
  created_at: string
  last_message?: string
}

export type Preference = {
  dimension: string
  value: string
  confidence: number
  sample_count?: number
}

export type Memory = {
  id: string
  content: string
  category: string
  emotion_tag?: string
  weight: number
  created_at: string
}

export type Topic = {
  keywords: string[]
  last_emotion_state?: string
  mention_count: number
  last_mentioned_at: string
}

export type Profile = {
  current_personality: string
  personality_prompt: string
  learning_stage: string
  interaction_count: number
  vocabulary_map: Record<string, string>
  show_thinking: boolean
  onboarding_completed: boolean
  show_emergency_button: boolean
  last_assessment?: string
  today_summary?: string
  notifications_enabled?: boolean
  reminder_hour?: number
  reminder_minute?: number
  focus_mode_silent?: boolean
}

export type CustomAction = {
  trigger_emotion: string
  action_description: string
  effectiveness_score: number
}

export type ConversationSummary = {
  conversation_id: string
  summary: string
  key_topics: string[]
  start_index: number  // 原始消息数组中的起始索引
  end_index: number    // 原始消息数组中的结束索引
  created_at: string
}

export type ActionLog = {
  id: string
  conversation_id: string
  action_description: string
  emotion_context?: string
  status: 'suggested' | 'done' | 'skipped'
  feedback?: string
  created_at: string
  updated_at?: string
}

export type GeneratedOutput = {
  id: string
  conversation_id: string
  output_type: string
  title: string
  content: string
  status: 'draft' | 'saved' | 'exported'
  created_at: string
  updated_at?: string
}

export type GratitudeEntry = {
  date: string
  items: string[]
}

export type MoodCheckin = {
  date: string
  emoji: string
  note?: string
}

export type VoiceProfile = {
  enabled: boolean
  auto_play: boolean
  provider: 'expo-speech' | 'openai-tts' | 'web-speech' | 'voice-cloning'
  voice_id: string
  voice_clone_server_url: string
  speed: number
  pitch: number
  expressiveness: number
  volume: number
  pause_style: number
  warmth: 'cool' | 'neutral' | 'warm'
  speed_confidence: number
  pitch_confidence: number
  expressiveness_confidence: number
  volume_confidence: number
  pause_style_confidence: number
  warmth_confidence: number
}

// ===== Conversations =====
const CONVERSATIONS_KEY = '@db:conversations'
const MESSAGES_PREFIX = '@db:messages:'

export async function getConversations(): Promise<Conversation[]> {
  const raw = await AsyncStorage.getItem(CONVERSATIONS_KEY)
  return safeJsonParse(raw, [])
}

export async function saveConversation(conv: Conversation): Promise<void> {
  const list = await getConversations()
  const idx = list.findIndex(c => c.id === conv.id)
  if (idx > -1) list[idx] = conv
  else list.push(conv)
  await AsyncStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(list))
}

export async function deleteConversation(id: string): Promise<void> {
  const list = await getConversations()
  await AsyncStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(list.filter(c => c.id !== id)))
  await AsyncStorage.removeItem(MESSAGES_PREFIX + id)
  // 级联删除关联数据
  const summaries = await getSummaries()
  const remaining = summaries.filter(s => s.conversation_id !== id)
  if (remaining.length !== summaries.length) {
    await AsyncStorage.setItem(SUMMARIES_KEY, JSON.stringify(remaining))
  }
  const logs = await getActionLogs()
  const keptLogs = logs.filter(l => l.conversation_id !== id)
  if (keptLogs.length !== logs.length) {
    await AsyncStorage.setItem(ACTION_LOGS_KEY, JSON.stringify(keptLogs))
  }
  const outputs = await getGeneratedOutputs()
  const keptOutputs = outputs.filter(o => o.conversation_id !== id)
  if (keptOutputs.length !== outputs.length) {
    await AsyncStorage.setItem(OUTPUTS_KEY, JSON.stringify(keptOutputs))
  }
}

// ===== Messages =====
export async function getMessages(convId: string): Promise<Message[]> {
  const raw = await AsyncStorage.getItem(MESSAGES_PREFIX + convId)
  return safeJsonParse(raw, [])
}

export async function addMessage(convId: string, msg: Message): Promise<void> {
  const list = await getMessages(convId)
  list.push(msg)
  await AsyncStorage.setItem(MESSAGES_PREFIX + convId, JSON.stringify(list))
}

export async function updateMessage(convId: string, msgId: string, updates: Partial<Message>): Promise<void> {
  const list = await getMessages(convId)
  const idx = list.findIndex(m => m.id === msgId)
  if (idx > -1) {
    list[idx] = { ...list[idx], ...updates }
    await AsyncStorage.setItem(MESSAGES_PREFIX + convId, JSON.stringify(list))
  }
}

// ===== Profile =====
const PROFILE_KEY = '@db:profile'

export async function getProfile(): Promise<Profile> {
  const raw = await AsyncStorage.getItem(PROFILE_KEY)
  if (raw) {
    const parsed = safeJsonParse(raw, null as any)
    if (parsed) return parsed
  }
  return {
    current_personality: 'tree_hole',
    personality_prompt: '',
    learning_stage: 'cold_start',
    interaction_count: 0,
    vocabulary_map: {},
    show_thinking: true,
    onboarding_completed: false,
    show_emergency_button: true,
  }
}

export async function saveProfile(profile: Profile): Promise<void> {
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
}

// ===== Preferences =====
const PREFERENCES_KEY = '@db:preferences'

export async function getPreferences(): Promise<Preference[]> {
  const raw = await AsyncStorage.getItem(PREFERENCES_KEY)
  return safeJsonParse(raw, [])
}

export async function savePreferences(prefs: Preference[]): Promise<void> {
  await AsyncStorage.setItem(PREFERENCES_KEY, JSON.stringify(prefs))
}

// ===== Memories =====
const MEMORIES_KEY = '@db:memories'

export async function getMemories(): Promise<Memory[]> {
  const raw = await AsyncStorage.getItem(MEMORIES_KEY)
  return safeJsonParse(raw, [])
}

export async function saveMemory(memory: Memory): Promise<void> {
  const list = await getMemories()
  list.push(memory)
  await AsyncStorage.setItem(MEMORIES_KEY, JSON.stringify(list))
}

export async function updateMemory(id: string, updates: Partial<Memory>): Promise<void> {
  const list = await getMemories()
  const idx = list.findIndex(m => m.id === id)
  if (idx > -1) {
    list[idx] = { ...list[idx], ...updates }
    await AsyncStorage.setItem(MEMORIES_KEY, JSON.stringify(list))
  }
}

export async function deleteMemory(id: string): Promise<void> {
  const list = await getMemories()
  await AsyncStorage.setItem(MEMORIES_KEY, JSON.stringify(list.filter(m => m.id !== id)))
}

// ===== Topics =====
const TOPICS_KEY = '@db:topics'

export async function getTopics(): Promise<Topic[]> {
  const raw = await AsyncStorage.getItem(TOPICS_KEY)
  return safeJsonParse(raw, [])
}

export async function saveTopics(topics: Topic[]): Promise<void> {
  await AsyncStorage.setItem(TOPICS_KEY, JSON.stringify(topics))
}

// ===== Custom Actions =====
const ACTIONS_KEY = '@db:custom_actions'

export async function getCustomActions(): Promise<CustomAction[]> {
  const raw = await AsyncStorage.getItem(ACTIONS_KEY)
  return safeJsonParse(raw, [])
}

export async function saveCustomActions(actions: CustomAction[]): Promise<void> {
  await AsyncStorage.setItem(ACTIONS_KEY, JSON.stringify(actions))
}

// ===== Conversation Summaries =====
const SUMMARIES_KEY = '@db:conversation_summaries'

export async function getSummaries(): Promise<ConversationSummary[]> {
  const raw = await AsyncStorage.getItem(SUMMARIES_KEY)
  return safeJsonParse(raw, [])
}

export async function saveSummary(summary: ConversationSummary): Promise<void> {
  const list = await getSummaries()
  const idx = list.findIndex(s => s.conversation_id === summary.conversation_id && s.start_index === summary.start_index)
  if (idx > -1) list[idx] = summary
  else list.push(summary)
  await AsyncStorage.setItem(SUMMARIES_KEY, JSON.stringify(list))
}

export async function getConversationSummaries(convId: string): Promise<ConversationSummary[]> {
  const list = await getSummaries()
  return list.filter(s => s.conversation_id === convId).sort((a, b) => a.start_index - b.start_index)
}

// ===== Action Logs =====
const ACTION_LOGS_KEY = '@db:action_logs'

export async function getActionLogs(): Promise<ActionLog[]> {
  const raw = await AsyncStorage.getItem(ACTION_LOGS_KEY)
  return safeJsonParse(raw, [])
}

export async function saveActionLog(log: ActionLog): Promise<void> {
  const list = await getActionLogs()
  list.push(log)
  await AsyncStorage.setItem(ACTION_LOGS_KEY, JSON.stringify(list))
}

export async function updateActionLog(id: string, updates: Partial<ActionLog>): Promise<void> {
  const list = await getActionLogs()
  const idx = list.findIndex(a => a.id === id)
  if (idx > -1) {
    list[idx] = { ...list[idx], ...updates, updated_at: new Date().toISOString() }
    await AsyncStorage.setItem(ACTION_LOGS_KEY, JSON.stringify(list))
  }
}

export async function getConversationActionLogs(convId: string): Promise<ActionLog[]> {
  const list = await getActionLogs()
  return list.filter(a => a.conversation_id === convId).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}

// ===== Generated Outputs =====
const OUTPUTS_KEY = '@db:generated_outputs'

export async function getGeneratedOutputs(): Promise<GeneratedOutput[]> {
  const raw = await AsyncStorage.getItem(OUTPUTS_KEY)
  return safeJsonParse(raw, [])
}

export async function saveGeneratedOutput(output: GeneratedOutput): Promise<void> {
  const list = await getGeneratedOutputs()
  list.push(output)
  await AsyncStorage.setItem(OUTPUTS_KEY, JSON.stringify(list))
}

export async function updateGeneratedOutput(id: string, updates: Partial<GeneratedOutput>): Promise<void> {
  const list = await getGeneratedOutputs()
  const idx = list.findIndex(o => o.id === id)
  if (idx > -1) {
    list[idx] = { ...list[idx], ...updates, updated_at: new Date().toISOString() }
    await AsyncStorage.setItem(OUTPUTS_KEY, JSON.stringify(list))
  }
}

export async function deleteGeneratedOutput(id: string): Promise<void> {
  const list = await getGeneratedOutputs()
  await AsyncStorage.setItem(OUTPUTS_KEY, JSON.stringify(list.filter(o => o.id !== id)))
}

// ===== Voice Profile =====
const VOICE_PROFILE_KEY = '@db:voice_profile'

export async function getVoiceProfile(): Promise<VoiceProfile> {
  const raw = await AsyncStorage.getItem(VOICE_PROFILE_KEY)
  if (raw) {
    const parsed = safeJsonParse(raw, null as any)
    if (parsed) return parsed
  }
  return {
    enabled: true,
    auto_play: false,
    provider: 'expo-speech',
    voice_id: '',
    voice_clone_server_url: '',
    speed: 1.0,
    pitch: 1.0,
    expressiveness: 0.6,
    volume: 0.7,
    pause_style: 0.5,
    warmth: 'neutral',
    speed_confidence: 0.3,
    pitch_confidence: 0.3,
    expressiveness_confidence: 0.3,
    volume_confidence: 0.3,
    pause_style_confidence: 0.3,
    warmth_confidence: 0.3,
  }
}

export async function saveVoiceProfile(profile: VoiceProfile): Promise<void> {
  await AsyncStorage.setItem(VOICE_PROFILE_KEY, JSON.stringify(profile))
}

// ===== Mood Checkins =====
const MOOD_CHECKINS_KEY = '@db:mood_checkins'

export async function getMoodCheckins(): Promise<MoodCheckin[]> {
  const raw = await AsyncStorage.getItem(MOOD_CHECKINS_KEY)
  return safeJsonParse(raw, [])
}

export async function saveMoodCheckin(checkin: MoodCheckin): Promise<void> {
  const list = await getMoodCheckins()
  const idx = list.findIndex(c => c.date === checkin.date)
  if (idx > -1) {
    list[idx] = checkin
  } else {
    list.push(checkin)
  }
  await AsyncStorage.setItem(MOOD_CHECKINS_KEY, JSON.stringify(list))

  // 同步小组件数据
  try {
    const { syncWidgetData } = await import('./widget-bridge')
    await syncWidgetData()
  } catch {}
}

export async function getMoodCheckinsRange(startDate: string, endDate: string): Promise<MoodCheckin[]> {
  const list = await getMoodCheckins()
  return list.filter(c => c.date >= startDate && c.date <= endDate)
}

// ===== Streak =====
const STREAK_KEY = '@db:streak'

export async function saveStreak(count: number): Promise<void> {
  await AsyncStorage.setItem(STREAK_KEY, JSON.stringify({ count, updated_at: new Date().toISOString() }))
  // 同步小组件数据
  try { const { syncWidgetData } = await import('./widget-bridge'); await syncWidgetData() } catch {}
}

export async function getStreak(): Promise<number> {
  const raw = await AsyncStorage.getItem(STREAK_KEY)
  if (raw) {
    try { return JSON.parse(raw).count || 0 } catch {}
  }
  return 0
}

// ===== Gratitude (Three Good Things) =====
const GRATITUDE_KEY = '@db:gratitude'

export async function getGratitudeEntries(): Promise<GratitudeEntry[]> {
  const raw = await AsyncStorage.getItem(GRATITUDE_KEY)
  return safeJsonParse(raw, [])
}

export async function saveGratitudeEntry(entry: GratitudeEntry): Promise<void> {
  const list = await getGratitudeEntries()
  const idx = list.findIndex(e => e.date === entry.date)
  if (idx > -1) {
    list[idx] = entry
  } else {
    list.push(entry)
  }
  await AsyncStorage.setItem(GRATITUDE_KEY, JSON.stringify(list))
}

export async function getTodayGratitude(): Promise<GratitudeEntry | null> {
  const today = new Date().toISOString().slice(0, 10)
  const list = await getGratitudeEntries()
  return list.find(e => e.date === today) || null
}

