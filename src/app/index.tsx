import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { router } from 'expo-router'
import { useEffect, useState, useCallback } from 'react'
import { hasAllKeys, getApiKey, KEYS, getApiSettings } from '../lib/storage'
import { useTheme } from '../lib/theme-context'
import * as db from '../lib/db'
import LearningBadge from '../components/learning-badge'
import MoodCheckin from '../components/mood-checkin'
import ThreeGoodThings from '../components/three-good-things'
import OnboardingGuide from '../components/onboarding-guide'

export default function HomeScreen() {
  const { theme } = useTheme()
  const [configured, setConfigured] = useState(false)
  const [learningStage, setLearningStage] = useState('cold_start')
  const [interactionCount, setInteractionCount] = useState(0)
  const [personality, setPersonality] = useState('')
  const [isFirstLaunch, setIsFirstLaunch] = useState(false)
  const [testing, setTesting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [testResult, setTestResult] = useState<'idle' | 'success' | 'fail'>('idle')
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [profile, setProfile] = useState<db.Profile | null>(null)
  const [showThreeGoodThings, setShowThreeGoodThings] = useState(false)

  useEffect(() => {
    (async () => {
      const [hasKey, profile] = await Promise.all([
        hasAllKeys(),
        db.getProfile(),
      ])
      setConfigured(hasKey)
      setPersonality(profile.current_personality)
      setLearningStage(profile.learning_stage)
      setInteractionCount(profile.interaction_count)

      setProfile(profile)

      if (!hasKey && profile.interaction_count === 0) {
        setIsFirstLaunch(true)
      }

      // 首次自动显示引导
      if (!profile.onboarding_completed) {
        setTimeout(() => setShowOnboarding(true), 500)
      }

      setLoading(false)
    })()
  }, [])

  // 连接测试后如果配置变化，重置测试状态
  useEffect(() => {
    setTestResult('idle')
  }, [configured])

  const handleTestConnection = useCallback(async () => {
    setTesting(true)
    setTestResult('idle')
    try {
      const key = await getApiKey(KEYS.ANTHROPIC_API_KEY)
      const settings = await getApiSettings()
      if (!key) { setTestResult('fail'); setTesting(false); return }

      const baseUrl = settings.baseUrl.replace(/\/+$/, '')
      const url = baseUrl.includes('openai.com')
        ? `${baseUrl}/v1/models`
        : `${baseUrl}/v1/messages`

      const res = await fetch(url, {
        method: settings.type === 'openai' ? 'GET' : 'POST',
        headers: settings.type === 'openai'
          ? { 'Authorization': `Bearer ${key}` }
          : { 'x-api-key': key || '', 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
        body: settings.type === 'openai' ? undefined : JSON.stringify({
          model: settings.model, max_tokens: 1, messages: [{ role: 'user', content: 'hi' }],
        }),
        signal: AbortSignal.timeout(10000),
      })
      setTestResult(res.ok ? 'success' : 'fail')
    } catch {
      setTestResult('fail')
    }
    setTesting(false)
  }, [])

  const handleOnboardingComplete = useCallback(async () => {
    setShowOnboarding(false)
    const p = profile || await db.getProfile()
    p.onboarding_completed = true
    await db.saveProfile(p)
  }, [profile])

  const personaLabel: Record<string, string> = {
    tree_hole: '🌳 树洞',
    frenemy: '😏 损友',
    elder: '🧓 长辈',
    battle_buddy: '🤝 战友',
  }

  const s = makeStyles(theme)

  return (
    <View style={[s.container, { backgroundColor: theme.background }]}>
      <Text style={s.title}>雨声</Text>
      <Text style={s.subtitle}>你的声音，我在听</Text>

      {/* 首次启动引导 */}
      {isFirstLaunch && (
        <View style={[s.setupBanner, { backgroundColor: theme.surface }]}>
          <Text style={s.welcomeTitle}>👋 欢迎来到雨声</Text>
          <Text style={s.setupText}>
            这是一个只属于你的情绪陪伴空间。{`\n`}开始前，需要先配置 API Key。
          </Text>
          <TouchableOpacity
            style={[s.setupButton, { backgroundColor: theme.accent }]}
            onPress={() => router.push('/settings')}
          >
            <Text style={s.setupButtonText}>配置 API Key</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 未配置但并非首次启动 */}
      {!configured && !isFirstLaunch && (
        <View style={[s.setupBanner, { backgroundColor: theme.surface }]}>
          <Text style={s.setupText}>
            请先在设置中配置 API Key
          </Text>
          <TouchableOpacity
            style={[s.setupButton, { backgroundColor: theme.border }]}
            onPress={() => router.push('/settings')}
          >
            <Text style={s.setupButtonText}>去配置</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 已配置但未验证连接 */}
      {configured && testResult === 'idle' && !testing && (
        <TouchableOpacity style={s.testBtn} onPress={handleTestConnection}>
          <Text style={s.testBtnText}>测试连接</Text>
        </TouchableOpacity>
      )}

      {/* 测试中 */}
      {testing && (
        <View style={s.testRow}>
          <ActivityIndicator size="small" color={theme.accent} />
          <Text style={{ color: theme.textMuted, fontSize: 13, marginLeft: 8 }}>测试中...</Text>
        </View>
      )}

      {/* 测试结果 */}
      {testResult === 'success' && (
        <Text style={{ color: theme.success, fontSize: 13, marginBottom: 16 }}>✅ 连接成功</Text>
      )}
      {testResult === 'fail' && (
        <Text style={{ color: theme.danger, fontSize: 13, marginBottom: 16 }}>❌ 连接失败，请检查 API Key</Text>
      )}

      {configured && (
        <View style={s.badgeRow}>
          <LearningBadge stage={learningStage} interactionCount={interactionCount} theme={theme} />
        </View>
      )}

      {configured && <MoodCheckin theme={theme} />}
      {configured && <ThreeGoodThings
        visible={showThreeGoodThings}
        onClose={() => setShowThreeGoodThings(false)}
        onSaved={() => {}}
        theme={theme}
      />}
      {configured && (<TouchableOpacity
        style={{ alignItems: 'center', marginBottom: 12 }}
        onPress={() => setShowThreeGoodThings(prev => !prev)}
      >
        <Text style={{ color: theme.textMuted, fontSize: 13 }}>
          {showThreeGoodThings ? '收起三件好事' : '🌱 今天三件好事'}
        </Text>
      </TouchableOpacity>
      )}

      {personality && (
        <Text style={s.personaText}>
          当前人格：{personaLabel[personality] || personality}
        </Text>
      )}

      <TouchableOpacity
        style={[s.chatButton, { backgroundColor: theme.accent }]}
        onPress={() => router.push('/chat/new')}
      >
        <Text style={s.chatButtonText}>开始对话</Text>
      </TouchableOpacity>

      <View style={s.quickRow}>
        <TouchableOpacity
          style={[s.quickButton, { backgroundColor: theme.surface }]}
          onPress={() => router.push('/conversations')}
        >
          <Text style={s.quickIcon}>💬</Text>
          <Text style={s.quickLabel}>历史对话</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.quickButton, { backgroundColor: theme.surface }]}
          onPress={() => router.push('/memories')}
        >
          <Text style={s.quickIcon}>🧠</Text>
          <Text style={s.quickLabel}>记忆库</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.quickButton, { backgroundColor: theme.surface }]}
          onPress={() => router.push('/insights')}
        >
          <Text style={s.quickIcon}>📊</Text>
          <Text style={s.quickLabel}>情绪洞察</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.quickButton, { backgroundColor: theme.surface }]}
          onPress={() => router.push('/outputs')}
        >
          <Text style={s.quickIcon}>📄</Text>
          <Text style={s.quickLabel}>生成内容</Text>
        </TouchableOpacity>
      </View>

      <View style={s.bottomRow}>
        <TouchableOpacity onPress={() => router.push('/settings')}>
          <Text style={s.bottomText}>设置</Text>
        </TouchableOpacity>
        <Text style={{ color: theme.textMuted, fontSize: 14 }}>·</Text>
        <TouchableOpacity onPress={() => setShowOnboarding(true)}>
          <Text style={s.bottomText}>新手引导</Text>
        </TouchableOpacity>
      </View>

      <OnboardingGuide
        visible={showOnboarding}
        onComplete={handleOnboardingComplete}
        theme={theme}
      />
    </View>
  )
}

function makeStyles(theme: any) {
  return StyleSheet.create({
    container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
    badgeRow: { width: '100%', marginBottom: 8 },
    title: { fontSize: 32, fontWeight: '700', color: theme.text, marginBottom: 8 },
    subtitle: { fontSize: 16, color: theme.textMuted, marginBottom: 32 },
    personaText: { color: theme.textMuted, fontSize: 13, marginBottom: 24 },
    setupBanner: { borderRadius: 12, padding: 20, marginBottom: 24, alignItems: 'center', width: '100%' },
    welcomeTitle: { fontSize: 20, fontWeight: '700', color: theme.text, marginBottom: 8 },
    setupText: { color: theme.textSecondary, fontSize: 14, marginBottom: 16, textAlign: 'center', lineHeight: 20 },
    setupButton: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
    setupButtonText: { color: '#fff', fontWeight: '600' },
    testBtn: { marginBottom: 16 },
    testBtnText: { color: theme.textMuted, fontSize: 13, textDecorationLine: 'underline' },
    testRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    chatButton: { paddingHorizontal: 48, paddingVertical: 16, borderRadius: 16, marginBottom: 32, width: '100%', alignItems: 'center' },
    chatButtonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
    quickRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginBottom: 32 },
    quickButton: { borderRadius: 12, padding: 16, alignItems: 'center', width: 100 },
    quickIcon: { fontSize: 24, marginBottom: 6 },
    quickLabel: { color: theme.textSecondary, fontSize: 13, fontWeight: '500' },
    bottomRow: { position: 'absolute', bottom: 48 },
    bottomText: { color: theme.textMuted, fontSize: 14 },
  })
}