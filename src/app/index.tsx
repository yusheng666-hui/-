import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { hasAllKeys } from '../lib/storage'
import { useTheme } from '../lib/theme-context'
import * as db from '../lib/db'
import MoodCheckin from '../components/mood-checkin'
import ThreeGoodThings from '../components/three-good-things'
import OnboardingGuide from '../components/onboarding-guide'

export default function HomeScreen() {
  const { theme } = useTheme()
  const [configured, setConfigured] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showThreeGoodThings, setShowThreeGoodThings] = useState(false)

  useEffect(() => {
    (async () => {
      const [hasKey, profile] = await Promise.all([
        hasAllKeys(),
        db.getProfile(),
      ])
      setConfigured(hasKey)

      // 首次自动显示引导
      if (!profile.onboarding_completed) {
        setTimeout(() => setShowOnboarding(true), 500)
      }

      setLoading(false)
    })()
  }, [])

  const handleOnboardingComplete = async () => {
    setShowOnboarding(false)
    const p = await db.getProfile()
    p.onboarding_completed = true
    await db.saveProfile(p)
  }

  const s = makeStyles(theme)

  return (
    <View style={[s.container, { backgroundColor: theme.background }]}>
      <Text style={s.title}>雨声</Text>
      <Text style={s.subtitle}>你的声音，我在听</Text>

      {/* 未配置提示 */}
      {!configured && (
        <TouchableOpacity onPress={() => router.push('/settings')} style={{ marginBottom: 24 }}>
          <Text style={{ color: theme.textMuted, fontSize: 13, textDecorationLine: 'underline' }}>
            请先在设置中配置 API Key 后开始使用
          </Text>
        </TouchableOpacity>
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
    title: { fontSize: 32, fontWeight: '700', color: theme.text, marginBottom: 8 },
    subtitle: { fontSize: 16, color: theme.textMuted, marginBottom: 32 },
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