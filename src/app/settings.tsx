import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
} from 'react-native'
import { useState, useEffect, useRef } from 'react'
import { router } from 'expo-router'
import { saveApiKey, getApiKey, saveApiSettings, getApiSettings, KEYS, type ApiType, type ApiSettings } from '../lib/storage'
import type { ThemeKey, ThemeColors } from '../lib/theme'
import { THEMES } from '../lib/theme'
import { useTheme } from '../lib/theme-context'
import * as db from '../lib/db'
import { generateId } from '../lib/utils'
import PreferenceBar from '../components/preference-bar'
import LearningBadge from '../components/learning-badge'

const PERSONALITIES = [
  { key: 'tree_hole', label: '树洞', desc: '温柔承接，不输出观点' },
  { key: 'frenemy', label: '损友', desc: '毒舌但关心' },
  { key: 'elder', label: '长辈', desc: '温和过来人视角' },
  { key: 'battle_buddy', label: '战友', desc: '陪你一起吐槽' },
]

const API_TYPES: Array<{ key: ApiType; label: string }> = [
  { key: 'anthropic', label: 'Anthropic (Claude)' },
  { key: 'openai', label: 'OpenAI 兼容' },
]

const DEFAULT_URLS: Record<ApiType, string> = {
  anthropic: 'https://api.anthropic.com',
  openai: 'https://api.openai.com',
}

const DEFAULT_MODELS: Record<ApiType, string> = {
  anthropic: 'claude-sonnet-4-20250514',
  openai: 'gpt-4o',
}

const THEME_OPTIONS: Array<{ key: ThemeKey; label: string; bg: string; accent: string }> = [
  { key: 'pure_white', label: '纯白', bg: THEMES.pure_white.background, accent: THEMES.pure_white.accent },
  { key: 'warm_cream', label: '暖白', bg: THEMES.warm_cream.background, accent: THEMES.warm_cream.accent },
  { key: 'soft_pink', label: '柔粉', bg: THEMES.soft_pink.background, accent: THEMES.soft_pink.accent },
  { key: 'deep_purple', label: '深空紫', bg: THEMES.deep_purple.background, accent: THEMES.deep_purple.accent },
  { key: 'warm_sunset', label: '暖阳橙', bg: THEMES.warm_sunset.background, accent: THEMES.warm_sunset.accent },
  { key: 'amoled_black', label: 'AMOLED 纯黑', bg: THEMES.amoled_black.background, accent: THEMES.amoled_black.accent },
]

export default function SettingsScreen() {
  const { theme: themeColors, themeKey: currentThemeKey, setThemeKey: setContextThemeKey } = useTheme()

  const [apiKey, setApiKey] = useState('')
  const [apiType, setApiType] = useState<ApiType>('anthropic')
  const [apiBaseUrl, setApiBaseUrl] = useState('')
  const [apiModel, setApiModel] = useState('')
  const [privacyMode, setPrivacyMode] = useState(true)

  const [personality, setPersonality] = useState('tree_hole')
  const [preferences, setPreferences] = useState<db.Preference[]>([])
  const [learningStage, setLearningStage] = useState('cold_start')
  const [interactionCount, setInteractionCount] = useState(0)
  const [voiceEnabled, setVoiceEnabled] = useState(false)
  const [autoPlay, setAutoPlay] = useState(false)
  const [voiceProvider, setVoiceProvider] = useState<string>('expo-speech')
  const [voiceSpeed, setVoiceSpeed] = useState(1.0)
  const [voicePitch, setVoicePitch] = useState(1.0)
  const [voiceVolume, setVoiceVolume] = useState(0.7)
  const [voiceCloneUrl, setVoiceCloneUrl] = useState('')
  const [voiceCloneVoiceId, setVoiceCloneVoiceId] = useState('')
  const [cloning, setCloning] = useState(false)
  const [showThinking, setShowThinking] = useState(true)
  const [showEmergencyBtn, setShowEmergencyBtn] = useState(true)
  const [customActions, setCustomActions] = useState<db.CustomAction[]>([])
  const [newActionEmotion, setNewActionEmotion] = useState('')
  const [newActionDesc, setNewActionDesc] = useState('')
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)
  const [reminderHour, setReminderHour] = useState(20)
  const [reminderMinute, setReminderMinute] = useState(0)
  const [focusModeSilent, setFocusModeSilent] = useState(false)

  useEffect(() => {
    ;(async () => {
      const key = await getApiKey(KEYS.ANTHROPIC_API_KEY)
      if (key) setApiKey(key)

      const settings = await getApiSettings()
      setApiType(settings.type)
      setApiBaseUrl(settings.baseUrl)
      setApiModel(settings.model)

      const pm = await getApiKey(KEYS.PRIVACY_MODE)
      if (pm !== null) setPrivacyMode(pm === 'true')

      const profile = await db.getProfile()
      setPersonality(profile.current_personality || 'tree_hole')
      setLearningStage(profile.learning_stage || 'cold_start')
      setInteractionCount(profile.interaction_count || 0)
      setNotificationsEnabled(profile.notifications_enabled === true)
      setReminderHour(profile.reminder_hour ?? 20)
      setReminderMinute(profile.reminder_minute ?? 0)
      setFocusModeSilent(profile.focus_mode_silent === true)

      const prefs = await db.getPreferences()
      if (prefs.length > 0) setPreferences(prefs)

      const vp = await db.getVoiceProfile()
      setVoiceEnabled(vp.enabled)
      setAutoPlay(vp.auto_play)
      setVoiceProvider(vp.provider)
      setVoiceSpeed(vp.speed)
      setVoicePitch(vp.pitch)
      setVoiceVolume(vp.volume)
      setVoiceCloneUrl(vp.voice_clone_server_url || '')
      setVoiceCloneVoiceId(vp.voice_id || '')

      setShowThinking(profile.show_thinking !== false)
      setShowEmergencyBtn(profile.show_emergency_button !== false)

      const actions = await db.getCustomActions()
      setCustomActions(actions)
    })()
  }, [])

  const handleThemeChange = async (key: ThemeKey) => {
    await setContextThemeKey(key)
  }

  const handleApiTypeChange = (type: ApiType) => {
    setApiType(type)
    if (apiBaseUrl === DEFAULT_URLS[apiType]) {
      setApiBaseUrl(DEFAULT_URLS[type])
    }
    if (apiModel === DEFAULT_MODELS[apiType]) {
      setApiModel(DEFAULT_MODELS[type])
    }
  }

  const handleExportData = async () => {
    if (Platform.OS === 'web' && typeof window === 'undefined') return
    try {
      const [convs, prefs, mems, profile, topics, actions, outputs] = await Promise.all([
        db.getConversations(),
        db.getPreferences(),
        db.getMemories(),
        db.getProfile(),
        db.getTopics(),
        db.getCustomActions(),
        db.getGeneratedOutputs(),
      ])

      const exportData = {
        exported_at: new Date().toISOString(),
        profile: { current_personality: profile.current_personality, learning_stage: profile.learning_stage, interaction_count: profile.interaction_count },
        conversations: convs.map(c => ({ id: c.id, mode: c.mode, created_at: c.created_at, round_count: c.current_round })),
        preferences: prefs,
        memories: mems.map(m => ({ content: m.content, category: m.category, emotion_tag: m.emotion_tag, weight: m.weight, created_at: m.created_at })),
        milestones: mems.filter(m => m.category === 'milestone').map(m => ({ description: m.content, type: m.emotion_tag, date: m.created_at })),
        topics,
        custom_actions: actions,
        generated_outputs: outputs.map(o => ({ title: o.title, type: o.output_type, status: o.status, created_at: o.created_at })),
      }

      const json = JSON.stringify(exportData, null, 2)

      if (Platform.OS === 'web') {
        const blob = new Blob([json], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `emotion-data-${new Date().toISOString().slice(0, 10)}.json`
        a.click()
        URL.revokeObjectURL(url)
      } else {
        const { Share } = require('react-native')
        await Share.share({ message: json })
      }

      Alert.alert('导出成功', '数据已导出')
    } catch (err) {
      Alert.alert('导出失败', err instanceof Error ? err.message : '未知错误')
    }
  }

  const fileInputRef = useRef<any>(null)

  const handleImportData = () => {
    if (Platform.OS === 'web' && fileInputRef.current) {
      fileInputRef.current.click()
    } else {
      Alert.alert('导入', '请在其他设备上打开此页面，或在 Web 端使用导入功能')
    }
  }

  const handleFileSelected = async (e: any) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      // 验证数据结构
      if (!data.profile && !data.memories && !data.conversations) {
        Alert.alert('格式错误', '无法识别此文件的数据格式')
        return
      }
      if (data.profile) await db.saveProfile(data.profile)
      if (data.preferences) await db.savePreferences(data.preferences)
      if (data.memories) {
        for (const m of data.memories) {
          await db.saveMemory({ id: generateId(), content: m.content, category: m.category || 'general', emotion_tag: m.emotion_tag, weight: m.weight || 1, created_at: m.created_at || new Date().toISOString() })
        }
      }
      if (data.conversations) {
        for (const c of data.conversations) {
          await db.saveConversation({ id: c.id, mode: c.mode || 'chat', current_round: c.round_count || 0, created_at: c.created_at || new Date().toISOString() })
        }
      }
      Alert.alert('导入成功', `已导入 ${data.memories?.length || 0} 条记忆、${data.conversations?.length || 0} 条对话`)
    } catch (err) {
      Alert.alert('导入失败', err instanceof Error ? err.message : '文件解析错误')
    }
    // 重置 input 以允许重复选择同一文件
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSave = async () => {
    try {
      if (apiKey) await saveApiKey(KEYS.ANTHROPIC_API_KEY, apiKey)
      await saveApiSettings({ type: apiType, baseUrl: apiBaseUrl, model: apiModel })

      const profile = await db.getProfile()
      profile.current_personality = personality
      await db.saveProfile(profile)

      Alert.alert('已保存', '配置已保存', [
        { text: '好的', onPress: () => router.back() },
      ])
    } catch {
      Alert.alert('错误', '保存失败，请重试')
    }
  }

  const s = makeStyles(themeColors)

  return (
    <ScrollView style={[s.container, { backgroundColor: themeColors.background }]} contentContainerStyle={s.content}>
      {/* 主题颜色 */}
      <Text style={s.sectionTitle}>主题颜色</Text>
      <Text style={s.sectionDesc}>选择你喜欢的界面色调</Text>
      <View style={s.themeRow}>
        {THEME_OPTIONS.map((opt) => {
          const isSelected = opt.key === currentThemeKey
          const borderCol = isSelected ? opt.accent : themeColors.border
          return (
            <TouchableOpacity
              key={opt.key}
              style={[s.themeOption, { borderColor: borderCol }]}
              onPress={() => handleThemeChange(opt.key)}
            >
              <View style={[s.themeCircle, { backgroundColor: opt.bg, borderColor: opt.accent }]}>
                <View style={[s.accentDot, { backgroundColor: opt.accent }]} />
              </View>
              <Text style={[s.themeLabel, { color: isSelected ? themeColors.text : themeColors.textMuted }]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>

      {/* API 配置 */}
      <Text style={s.sectionTitle}>API 配置</Text>
      <Text style={s.sectionDesc}>
        Key 仅加密存储在本地设备，不会上传到服务器
      </Text>

      <Text style={s.label}>API 类型</Text>
      <View style={s.apiTypeRow}>
        {API_TYPES.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[s.apiTypeBtn, apiType === t.key && { borderColor: themeColors.accent }]}
            onPress={() => handleApiTypeChange(t.key)}
          >
            <Text style={[s.apiTypeText, apiType === t.key && { color: themeColors.text }]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={s.label}>API 地址</Text>
      <TextInput
        style={s.input}
        value={apiBaseUrl}
        onChangeText={setApiBaseUrl}
        placeholder="https://api.anthropic.com"
        placeholderTextColor="#555"
        autoCapitalize="none"
      />

      <Text style={s.label}>模型名</Text>
      <TextInput
        style={s.input}
        value={apiModel}
        onChangeText={setApiModel}
        placeholder="claude-sonnet-4-20250514"
        placeholderTextColor="#555"
        autoCapitalize="none"
      />

      <Text style={s.label}>API Key</Text>
      <TextInput
        style={s.input}
        value={apiKey}
        onChangeText={setApiKey}
        placeholder="sk-..."
        placeholderTextColor="#555"
        secureTextEntry
        autoCapitalize="none"
      />

      {/* 学习阶段 */}
      <Text style={[s.sectionTitle, { marginTop: 32 }]}>学习进度</Text>
      <LearningBadge stage={learningStage} interactionCount={interactionCount} theme={themeColors} />

      {/* 思考过程显示 */}
      <TouchableOpacity
        style={[s.toggleRow, { borderColor: themeColors.border }]}
        onPress={async () => {
          const profile = await db.getProfile()
          profile.show_thinking = !profile.show_thinking
          await db.saveProfile(profile)
          setShowThinking(profile.show_thinking)
        }}
      >
        <Text style={s.toggleLabel}>🧠 显示思考过程</Text>
        <Text style={[s.toggleValue, { color: themeColors.accent }]}>{showThinking ? '开启' : '关闭'}</Text>
      </TouchableOpacity>
      <Text style={s.hint}>
        关闭后 AI 的思考分析过程将完全隐藏，聊天界面更简洁
      </Text>

      <TouchableOpacity
        style={s.toggleRow}
        onPress={async () => {
          const profile = await db.getProfile()
          profile.show_emergency_button = !profile.show_emergency_button
          await db.saveProfile(profile)
          const next = profile.show_emergency_button
          setShowEmergencyBtn(next)
        }}
      >
        <Text style={s.toggleLabel}>🫂 情绪急救按钮</Text>
        <Text style={[s.toggleValue, { color: themeColors.accent }]}>{showEmergencyBtn ? '开启' : '关闭'}</Text>
      </TouchableOpacity>
      <Text style={s.hint}>
        所有页面右下角显示浮动急救按钮，快速进入急救模式
      </Text>

      {/* 通知设置 */}
      <Text style={[s.sectionTitle, { marginTop: 32 }]}>通知与专注模式</Text>

      <TouchableOpacity
        style={[s.toggleRow, { borderColor: themeColors.border }]}
        onPress={async () => {
          const profile = await db.getProfile()
          profile.notifications_enabled = !profile.notifications_enabled
          await db.saveProfile(profile)
          setNotificationsEnabled(profile.notifications_enabled)
          if (profile.notifications_enabled) {
            const { initNotifications } = await import('../lib/notifications')
            await initNotifications()
          } else {
            const { cancelAllReminders } = await import('../lib/notifications')
            await cancelAllReminders()
          }
        }}
      >
        <Text style={s.toggleLabel}>🔔 每日签到提醒</Text>
        <Text style={[s.toggleValue, { color: themeColors.accent }]}>{notificationsEnabled ? '开启' : '关闭'}</Text>
      </TouchableOpacity>
      <Text style={s.hint}>
        每天指定时间提醒你记录心情（已签到则不提醒）
      </Text>

      {notificationsEnabled && (
        <View style={{ marginTop: 8 }}>
          <Text style={s.label}>提醒时间</Text>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
            <View style={{ flex: 1 }}>
              <Text style={[s.label, { marginTop: 0 }]}>时</Text>
              <View style={{ flexDirection: 'row', gap: 4 }}>
                {[8, 12, 18, 20, 22].map(h => (
                  <TouchableOpacity
                    key={h}
                    style={[s.apiTypeBtn, reminderHour === h && { borderColor: themeColors.accent }]}
                    onPress={async () => {
                      const profile = await db.getProfile()
                      profile.reminder_hour = h
                      await db.saveProfile(profile)
                      setReminderHour(h)
                      const { scheduleDailyReminder } = await import('../lib/notifications')
                      await scheduleDailyReminder(h, reminderMinute)
                    }}
                  >
                    <Text style={[s.apiTypeText, reminderHour === h && { color: themeColors.text }]}>{h}时</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.label, { marginTop: 0 }]}>分</Text>
              <View style={{ flexDirection: 'row', gap: 4 }}>
                {[0, 15, 30, 45].map(m => (
                  <TouchableOpacity
                    key={m}
                    style={[s.apiTypeBtn, reminderMinute === m && { borderColor: themeColors.accent }]}
                    onPress={async () => {
                      const profile = await db.getProfile()
                      profile.reminder_minute = m
                      await db.saveProfile(profile)
                      setReminderMinute(m)
                      const { scheduleDailyReminder } = await import('../lib/notifications')
                      await scheduleDailyReminder(reminderHour, m)
                    }}
                  >
                    <Text style={[s.apiTypeText, reminderMinute === m && { color: themeColors.text }]}>{m}分</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </View>
      )}

      <TouchableOpacity
        style={[s.toggleRow, { borderColor: themeColors.border }]}
        onPress={async () => {
          const profile = await db.getProfile()
          profile.focus_mode_silent = !profile.focus_mode_silent
          await db.saveProfile(profile)
          setFocusModeSilent(profile.focus_mode_silent)
        }}
      >
        <Text style={s.toggleLabel}>🌙 专注模式静默</Text>
        <Text style={[s.toggleValue, { color: themeColors.accent }]}>{focusModeSilent ? '开启' : '关闭'}</Text>
      </TouchableOpacity>
      <Text style={s.hint}>
        开启后通知在专注模式下静默送达，App 自动限制对话轮次
      </Text>

      <Text style={s.sectionTitle}>AI 人格</Text>
      <Text style={s.sectionDesc}>选择 AI 与你沟通的方式</Text>
      {PERSONALITIES.map((p) => (
        <TouchableOpacity
          key={p.key}
          style={[
            s.personalityCard,
            personality === p.key && { borderColor: themeColors.accent },
          ]}
          onPress={() => setPersonality(p.key)}
        >
          <Text
            style={[
              s.personalityLabel,
              personality === p.key && { color: themeColors.text },
            ]}
          >
            {p.label}
          </Text>
          <Text style={s.personalityDesc}>{p.desc}</Text>
          {personality === p.key && <Text style={[s.check, { color: themeColors.accent }]}>✓</Text>}
        </TouchableOpacity>
      ))}

      {/* 偏好置信度面板 */}
      {preferences.length > 0 && (
        <>
          <Text style={[s.sectionTitle, { marginTop: 32 }]}>
            我的沟通偏好
          </Text>
          <Text style={s.sectionDesc}>
            AI 通过学习你对回复的反应推断出的偏好
          </Text>
          {preferences.map((pref) => (
            <PreferenceBar
              key={pref.dimension}
              dimension={pref.dimension}
              value={pref.value}
              confidence={pref.confidence}
              theme={themeColors}
            />
          ))}
        </>
      )}

      {/* 自定义动作 */}
      <Text style={[s.sectionTitle, { marginTop: 32 }]}>自定义动作</Text>
      <Text style={s.sectionDesc}>
        当 AI 检测到你处于特定情绪时，会主动推荐对应的动作
      </Text>

      {customActions.map((action, idx) => (
        <View key={idx} style={[s.actionCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
          <View style={s.actionCardHeader}>
            <Text style={[s.actionEmotion, { color: themeColors.accent }]}>{action.trigger_emotion}</Text>
            <TouchableOpacity onPress={async () => {
              const updated = customActions.filter((_, i) => i !== idx)
              setCustomActions(updated)
              await db.saveCustomActions(updated)
            }}>
              <Text style={{ color: themeColors.textMuted, fontSize: 16 }}>✕</Text>
            </TouchableOpacity>
          </View>
          <Text style={[s.actionDescText, { color: themeColors.textSecondary }]}>{action.action_description}</Text>
        </View>
      ))}

      <View style={[s.addActionRow, { borderColor: themeColors.border }]}>
        <TextInput
          style={[s.addActionInput, { backgroundColor: themeColors.surface, color: themeColors.text, borderColor: themeColors.border }]}
          value={newActionEmotion}
          onChangeText={setNewActionEmotion}
          placeholder="触发情绪（如 焦虑）"
          placeholderTextColor={themeColors.textMuted}
        />
        <TextInput
          style={[s.addActionInput, { backgroundColor: themeColors.surface, color: themeColors.text, borderColor: themeColors.border }]}
          value={newActionDesc}
          onChangeText={setNewActionDesc}
          placeholder="动作描述（如 去阳台深呼吸）"
          placeholderTextColor={themeColors.textMuted}
        />
        <TouchableOpacity
          style={[s.addActionBtn, { backgroundColor: themeColors.accent }]}
          onPress={async () => {
            if (!newActionEmotion.trim() || !newActionDesc.trim()) return
            const updated = [...customActions, {
              trigger_emotion: newActionEmotion.trim(),
              action_description: newActionDesc.trim(),
              effectiveness_score: 0,
            }]
            setCustomActions(updated)
            await db.saveCustomActions(updated)
            setNewActionEmotion('')
            setNewActionDesc('')
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '600' }}>添加</Text>
        </TouchableOpacity>
      </View>

      {/* 隐私设置 */}
      <Text style={[s.sectionTitle, { marginTop: 32 }]}>隐私</Text>
      <TouchableOpacity
        style={[s.toggleRow, { borderColor: themeColors.border }]}
        onPress={async () => {
          const next = !privacyMode
          setPrivacyMode(next)
          await saveApiKey(KEYS.PRIVACY_MODE, next ? 'true' : 'false')
        }}
      >
        <Text style={s.toggleLabel}>App Switcher 模糊保护</Text>
        <Text style={[s.toggleValue, { color: themeColors.accent }]}>{privacyMode ? '开启' : '关闭'}</Text>
      </TouchableOpacity>
      <Text style={s.hint}>
        开启后，切换到其他 App 时当前界面会被模糊覆盖
      </Text>

      {/* 语音回复 */}
      <Text style={[s.sectionTitle, { marginTop: 32 }]}>语音回复</Text>
      <TouchableOpacity
        style={[s.toggleRow, { borderColor: themeColors.border }]}
        onPress={async () => {
          const vp = await db.getVoiceProfile()
          vp.enabled = !vp.enabled
          await db.saveVoiceProfile(vp)
          setVoiceEnabled(vp.enabled)
        }}
      >
        <Text style={s.toggleLabel}>🔊 启用语音回复</Text>
        <Text style={[s.toggleValue, { color: themeColors.accent }]}>{voiceEnabled ? '开启' : '关闭'}</Text>
      </TouchableOpacity>

      {voiceEnabled && (
        <>
          <TouchableOpacity
            style={[s.toggleRow, { borderColor: themeColors.border }]}
            onPress={async () => {
              const vp = await db.getVoiceProfile()
              vp.auto_play = !vp.auto_play
              await db.saveVoiceProfile(vp)
              setAutoPlay(vp.auto_play)
            }}
          >
            <Text style={s.toggleLabel}>自动朗读回复</Text>
            <Text style={[s.toggleValue, { color: themeColors.accent }]}>{autoPlay ? '开启' : '关闭'}</Text>
          </TouchableOpacity>

          <Text style={s.label}>TTS 供应商</Text>
          <View style={s.apiTypeRow}>
            {[
              { key: 'expo-speech', label: '系统 TTS' },
              { key: 'openai-tts', label: 'OpenAI TTS' },
              { key: 'voice-cloning', label: '我的声音' },
            ].map(t => (
              <TouchableOpacity
                key={t.key}
                style={[s.apiTypeBtn, voiceProvider === t.key && { borderColor: themeColors.accent }]}
                onPress={async () => {
                  const vp = await db.getVoiceProfile()
                  vp.provider = t.key as any
                  await db.saveVoiceProfile(vp)
                  setVoiceProvider(t.key as any)
                }}
              >
                <Text style={[s.apiTypeText, voiceProvider === t.key && { color: themeColors.text }]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* 语音克隆配置 */}
          {voiceProvider === 'voice-cloning' && (
            <View style={{ marginTop: 12 }}>
              <Text style={s.label}>服务器地址</Text>
              <TextInput
                style={s.input}
                value={voiceCloneUrl}
                onChangeText={async (url) => {
                  setVoiceCloneUrl(url)
                  const vp = await db.getVoiceProfile()
                  vp.voice_clone_server_url = url
                  await db.saveVoiceProfile(vp)
                }}
                placeholder="https://用户名-空间名.hf.space"
                placeholderTextColor={themeColors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={s.hint}>
                部署语音克隆服务器后获得的 URL，详见 voice-server/README.md
              </Text>

              <Text style={s.label}>声纹 ID</Text>
              <TextInput
                style={s.input}
                value={voiceCloneVoiceId}
                onChangeText={async (vid) => {
                  setVoiceCloneVoiceId(vid)
                  const vp = await db.getVoiceProfile()
                  vp.voice_id = vid
                  await db.saveVoiceProfile(vp)
                }}
                placeholder="在服务器上克隆声音后获得"
                placeholderTextColor={themeColors.textMuted}
                autoCapitalize="none"
              />
              <Text style={s.hint}>
                在服务器「录制声音」页上传语音后获得声纹 ID
              </Text>

              {voiceCloneUrl ? (
                <TouchableOpacity
                  style={[s.apiTypeBtn, { borderColor: themeColors.accent, marginTop: 8 }]}
                  onPress={() => {
                    // Open the voice server in browser/external webview
                    if (Platform.OS === 'web') {
                      window.open(voiceCloneUrl, '_blank')
                    } else {
                      Alert.alert(
                        '打开语音克隆页面',
                        `请在浏览器中打开: ${voiceCloneUrl}\n\n1. 进入「录制声音」标签页\n2. 录制或上传你的语音\n3. 获得声纹 ID 后粘贴到上方`,
                      )
                    }
                  }}
                >
                  <Text style={{ color: themeColors.text, fontSize: 14 }}>
                    🎤 打开语音克隆页面
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )}

          <Text style={s.label}>语速 {voiceSpeed.toFixed(1)}x</Text>
          <View style={s.sliderRow}>
            <TouchableOpacity style={s.sliderBtn} onPress={async () => {
              const vp = await db.getVoiceProfile()
              vp.speed = Math.max(0.5, vp.speed - 0.1)
              await db.saveVoiceProfile(vp)
              setVoiceSpeed(vp.speed)
            }}><Text style={{ color: themeColors.text }}>−</Text></TouchableOpacity>
            <View style={[s.sliderTrack, { backgroundColor: themeColors.border }]}>
              <View style={[s.sliderFill, { width: `${((voiceSpeed - 0.5) / 1.0) * 100}%`, backgroundColor: themeColors.accent }]} />
            </View>
            <TouchableOpacity style={s.sliderBtn} onPress={async () => {
              const vp = await db.getVoiceProfile()
              vp.speed = Math.min(1.5, vp.speed + 0.1)
              await db.saveVoiceProfile(vp)
              setVoiceSpeed(vp.speed)
            }}><Text style={{ color: themeColors.text }}>+</Text></TouchableOpacity>
          </View>

          <Text style={s.label}>音调 {voicePitch.toFixed(1)}</Text>
          <View style={s.sliderRow}>
            <TouchableOpacity style={s.sliderBtn} onPress={async () => {
              const vp = await db.getVoiceProfile()
              vp.pitch = Math.max(0.5, vp.pitch - 0.1)
              await db.saveVoiceProfile(vp)
              setVoicePitch(vp.pitch)
            }}><Text style={{ color: themeColors.text }}>−</Text></TouchableOpacity>
            <View style={[s.sliderTrack, { backgroundColor: themeColors.border }]}>
              <View style={[s.sliderFill, { width: `${((voicePitch - 0.5) / 1.0) * 100}%`, backgroundColor: themeColors.accent }]} />
            </View>
            <TouchableOpacity style={s.sliderBtn} onPress={async () => {
              const vp = await db.getVoiceProfile()
              vp.pitch = Math.min(1.5, vp.pitch + 0.1)
              await db.saveVoiceProfile(vp)
              setVoicePitch(vp.pitch)
            }}><Text style={{ color: themeColors.text }}>+</Text></TouchableOpacity>
          </View>

          <Text style={s.label}>音量 {Math.round(voiceVolume * 100)}%</Text>
          <View style={s.sliderRow}>
            <TouchableOpacity style={s.sliderBtn} onPress={async () => {
              const vp = await db.getVoiceProfile()
              vp.volume = Math.max(0.3, vp.volume - 0.1)
              await db.saveVoiceProfile(vp)
              setVoiceVolume(vp.volume)
            }}><Text style={{ color: themeColors.text }}>−</Text></TouchableOpacity>
            <View style={[s.sliderTrack, { backgroundColor: themeColors.border }]}>
              <View style={[s.sliderFill, { width: `${voiceVolume * 100}%`, backgroundColor: themeColors.accent }]} />
            </View>
            <TouchableOpacity style={s.sliderBtn} onPress={async () => {
              const vp = await db.getVoiceProfile()
              vp.volume = Math.min(1.0, vp.volume + 0.1)
              await db.saveVoiceProfile(vp)
              setVoiceVolume(vp.volume)
            }}><Text style={{ color: themeColors.text }}>+</Text></TouchableOpacity>
          </View>
        </>
      )}

      {/* 数据导出 */}
      <Text style={[s.sectionTitle, { marginTop: 32 }]}>数据</Text>
      <TouchableOpacity
        style={[s.toggleRow, { borderColor: themeColors.border }]}
        onPress={handleExportData}
      >
        <Text style={s.toggleLabel}>📤 一键导出所有数据</Text>
        <Text style={[s.toggleValue, { color: themeColors.accent }]}>导出</Text>
      </TouchableOpacity>
      <Text style={s.hint}>
        生成 JSON 文件：记忆 + 对话 + 偏好 + 里程碑（不含 API Key）
      </Text>

      <TouchableOpacity
        style={[s.toggleRow, { borderColor: themeColors.border }]}
        onPress={handleImportData}
      >
        <Text style={s.toggleLabel}>📥 从 JSON 导入数据</Text>
        <Text style={[s.toggleValue, { color: themeColors.accent }]}>导入</Text>
      </TouchableOpacity>
      <Text style={s.hint}>
        覆盖当前所有数据（操作不可撤销）
      </Text>

      {/* 隐藏的文件选择器（Web） */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleFileSelected}
      />

      <TouchableOpacity style={[s.saveButton, { backgroundColor: themeColors.accent }]} onPress={handleSave}>
        <Text style={s.saveText}>保存配置</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

function makeStyles(theme: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1 },
    content: { padding: 24 },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.text,
      marginBottom: 4,
    },
    sectionDesc: {
      fontSize: 13,
      color: theme.textMuted,
      marginBottom: 16,
    },
    label: {
      fontSize: 14,
      color: theme.textSecondary,
      marginBottom: 6,
      marginTop: 16,
    },
    input: {
      backgroundColor: theme.surface,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: theme.text,
      fontSize: 15,
      borderWidth: 1,
      borderColor: theme.border,
    },
    apiTypeRow: {
      flexDirection: 'row',
      gap: 10,
    },
    apiTypeBtn: {
      flex: 1,
      backgroundColor: theme.surface,
      borderRadius: 10,
      paddingVertical: 12,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    apiTypeText: {
      color: theme.textMuted,
      fontSize: 14,
      fontWeight: '500',
    },
    personalityCard: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: theme.border,
      flexDirection: 'row',
      alignItems: 'center',
    },
    personalityLabel: {
      color: theme.textSecondary,
      fontSize: 16,
      fontWeight: '600',
      width: 44,
    },
    personalityDesc: {
      color: theme.textMuted,
      fontSize: 13,
      flex: 1,
    },
    check: {
      fontSize: 18,
      fontWeight: '700',
      marginLeft: 8,
    },
    toggleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderRadius: 10,
      padding: 16,
      marginTop: 8,
      borderWidth: 1,
      borderColor: theme.border,
    },
    toggleLabel: {
      color: theme.text,
      fontSize: 15,
    },
    toggleValue: {
      fontWeight: '600',
    },
    hint: {
      color: theme.textMuted,
      fontSize: 12,
      marginTop: 4,
      paddingLeft: 4,
    },
    saveButton: {
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 32,
    },
    saveText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
    themeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginBottom: 16,
    },
    sliderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 12,
    },
    sliderBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: 'rgba(128,128,128,0.2)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    sliderTrack: {
      flex: 1,
      height: 4,
      borderRadius: 2,
      overflow: 'hidden',
    },
    sliderFill: {
      height: '100%',
      borderRadius: 2,
    },
    themeOption: {
      alignItems: 'center',
      padding: 8,
      paddingBottom: 12,
      borderRadius: 12,
      borderWidth: 2,
      width: 82,
    },
    themeCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      marginBottom: 6,
      alignItems: 'center',
      justifyContent: 'center',
    },
    accentDot: {
      width: 14,
      height: 14,
      borderRadius: 7,
    },
    themeLabel: {
      fontSize: 11,
      fontWeight: '500',
    },
    actionCard: {
      borderRadius: 10,
      padding: 14,
      marginBottom: 8,
      borderWidth: 1,
    },
    actionCardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    actionEmotion: {
      fontSize: 14,
      fontWeight: '600',
    },
    actionDescText: {
      fontSize: 14,
    },
    addActionRow: {
      borderRadius: 10,
      padding: 14,
      borderWidth: 1,
      gap: 8,
      marginTop: 4,
    },
    addActionInput: {
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      borderWidth: 1,
    },
    addActionBtn: {
      borderRadius: 8,
      paddingVertical: 10,
      alignItems: 'center',
    },
  })
}
