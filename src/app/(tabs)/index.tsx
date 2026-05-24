import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native'
import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { hasAllKeys } from '../../lib/storage'
import { useTheme } from '../../lib/theme-context'
import * as db from '../../lib/db'
import MoodCheckin from '../../components/mood-checkin'
import ThreeGoodThings from '../../components/three-good-things'
import OnboardingGuide from '../../components/onboarding-guide'
import DailyChallenges from '../../components/daily-challenges'
import BreathingExercise from '../../components/breathing-exercise'

export default function HomeTab() {
  const { theme } = useTheme()
  const [configured, setConfigured] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showThreeGoodThings, setShowThreeGoodThings] = useState(false)
  const [showBreathing, setShowBreathing] = useState(false)

  useEffect(() => {
    (async () => {
      const [hasKey, profile] = await Promise.all([
        hasAllKeys(),
        db.getProfile(),
      ])
      setConfigured(hasKey)

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

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={styles.container}
    >
      <Text style={[styles.title, { color: theme.text }]}>雨声</Text>
      <Text style={[styles.subtitle, { color: theme.textMuted }]}>
        你的声音，我在听
      </Text>

      {!configured && (
        <TouchableOpacity onPress={() => router.push('/settings')} style={{ marginBottom: 24 }}>
          <Text style={{ color: theme.textMuted, fontSize: 13, textDecorationLine: 'underline' }}>
            请先在设置中配置 API Key 后开始使用
          </Text>
        </TouchableOpacity>
      )}

      {configured && <MoodCheckin theme={theme} />}

      {configured && (
        <DailyChallenges
          theme={theme}
          onStartBreathing={() => setShowBreathing(true)}
        />
      )}

      {configured && (
        <TouchableOpacity
          style={[styles.breatheBtn, { backgroundColor: theme.accent + '15', borderColor: theme.accent + '30' }]}
          onPress={() => setShowBreathing(true)}
        >
          <Text style={{ fontSize: 24 }}>🫁</Text>
          <Text style={[styles.breatheText, { color: theme.accent }]}>呼吸练习</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={[styles.chatButton, { backgroundColor: theme.accent }]}
        onPress={() => router.push('/chat/new')}
      >
        <Text style={styles.chatButtonText}>开始对话</Text>
      </TouchableOpacity>

      <View style={styles.quickRow}>
        <QuickBtn emoji="💬" label="历史对话" theme={theme} onPress={() => router.push('/conversations')} />
        <QuickBtn emoji="🧠" label="记忆库" theme={theme} onPress={() => router.push('/memories')} />
        <QuickBtn emoji="📊" label="情绪洞察" theme={theme} onPress={() => router.push('/insights')} />
        <QuickBtn emoji="📄" label="生成内容" theme={theme} onPress={() => router.push('/outputs')} />
      </View>

      <ThreeGoodThings
        visible={showThreeGoodThings}
        onClose={() => setShowThreeGoodThings(false)}
        onSaved={() => {}}
        theme={theme}
      />
      <TouchableOpacity
        style={{ alignItems: 'center', marginBottom: 16 }}
        onPress={() => setShowThreeGoodThings((p) => !p)}
      >
        <Text style={{ color: theme.textMuted, fontSize: 13 }}>
          {showThreeGoodThings ? '收起三件好事' : '🌱 今天三件好事'}
        </Text>
      </TouchableOpacity>

      <OnboardingGuide
        visible={showOnboarding}
        onComplete={handleOnboardingComplete}
        theme={theme}
      />

      <BreathingExercise
        visible={showBreathing}
        onClose={() => setShowBreathing(false)}
        theme={theme}
      />
    </ScrollView>
  )
}

function QuickBtn({ emoji, label, theme, onPress }: { emoji: string; label: string; theme: any; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.quickBtn, { backgroundColor: theme.surface }]}
      onPress={onPress}
    >
      <Text style={styles.quickEmoji}>{emoji}</Text>
      <Text style={[styles.quickLabel, { color: theme.textSecondary }]}>{label}</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 48, paddingBottom: 100, alignItems: 'center' },
  title: { fontSize: 32, fontWeight: '700', marginBottom: 6 },
  subtitle: { fontSize: 16, marginBottom: 28 },
  chatButton: { paddingHorizontal: 48, paddingVertical: 16, borderRadius: 16, marginBottom: 24, width: '100%', alignItems: 'center' },
  chatButtonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  breatheBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 14, paddingHorizontal: 24,
    borderRadius: 16, borderWidth: 1, marginBottom: 20, width: '100%',
  },
  breatheText: { fontSize: 15, fontWeight: '600' },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginBottom: 24 },
  quickBtn: { borderRadius: 12, padding: 14, alignItems: 'center', width: 95 },
  quickEmoji: { fontSize: 26, marginBottom: 4 },
  quickLabel: { fontSize: 12, fontWeight: '500' },
})
