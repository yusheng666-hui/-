import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native'
import { router } from 'expo-router'
import { useEffect, useState, useCallback } from 'react'
import { hasAllKeys } from '../../lib/storage'
import { useTheme } from '../../lib/theme-context'
import * as db from '../../lib/db'
import MoodCheckin from '../../components/mood-checkin'
import ThreeGoodThings from '../../components/three-good-things'
import OnboardingGuide from '../../components/onboarding-guide'
import DailyChallenges from '../../components/daily-challenges'
import BreathingExercise from '../../components/breathing-exercise'

function getGreeting() {
  const h = new Date().getHours()
  if (h < 6) return { text: '夜深了', emoji: '🌙' }
  if (h < 9) return { text: '早上好', emoji: '☀️' }
  if (h < 12) return { text: '上午好', emoji: '🌤️' }
  if (h < 14) return { text: '中午好', emoji: '🌞' }
  if (h < 18) return { text: '下午好', emoji: '🌻' }
  if (h < 21) return { text: '晚上好', emoji: '🌆' }
  return { text: '夜深了', emoji: '🌙' }
}

export default function HomeTab() {
  const { theme } = useTheme()
  const [configured, setConfigured] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showThreeGoodThings, setShowThreeGoodThings] = useState(false)
  const [showBreathing, setShowBreathing] = useState(false)
  const [stats, setStats] = useState({ conversations: 0, memories: 0, checkins: 0 })
  const [recentMood, setRecentMood] = useState<string | null>(null)

  const loadStats = useCallback(async () => {
    const [convs, mems, checkins] = await Promise.all([
      db.getConversations(),
      db.getMemories(),
      db.getMoodCheckins(),
    ])
    setStats({ conversations: convs.length, memories: mems.length, checkins: checkins.length })
    if (checkins.length > 0) {
      checkins.sort((a: any, b: any) => b.date.localeCompare(a.date))
      setRecentMood(checkins[0].emoji)
    }
  }, [])

  useEffect(() => {
    (async () => {
      const [hasKey, profile] = await Promise.all([
        hasAllKeys(),
        db.getProfile(),
      ])
      setConfigured(hasKey)

      if (hasKey) await loadStats()

      if (!profile.onboarding_completed) {
        setTimeout(() => setShowOnboarding(true), 500)
      }
    })()
  }, [])

  const handleOnboardingComplete = async () => {
    setShowOnboarding(false)
    const p = await db.getProfile()
    p.onboarding_completed = true
    await db.saveProfile(p)
  }

  const greeting = getGreeting()

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={styles.container}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.greeting, { color: theme.textSecondary }]}>
            {greeting.emoji} {greeting.text}
          </Text>
          <Text style={[styles.title, { color: theme.text }]}>雨声</Text>
        </View>
        <Text style={[styles.tagline, { color: theme.textMuted }]}>
          你的声音，我在听
        </Text>
      </View>

      {!configured ? (
        <TouchableOpacity
          style={[styles.setupBanner, { backgroundColor: theme.accent + '12', borderColor: theme.accent + '30' }]}
          onPress={() => router.push('/settings')}
        >
          <Text style={{ fontSize: 20 }}>🔑</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.setupTitle, { color: theme.text }]}>开始设置</Text>
            <Text style={[styles.setupDesc, { color: theme.textMuted }]}>配置 API Key 即可开始使用 AI 情绪陪伴</Text>
          </View>
          <Text style={[styles.setupArrow, { color: theme.accent }]}>›</Text>
        </TouchableOpacity>
      ) : (
        <>
          {/* Stats row */}
          {(stats.conversations > 0 || stats.checkins > 0) && (
            <View style={styles.statsRow}>
              {stats.conversations > 0 && (
                <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Text style={[styles.statNum, { color: theme.accent }]}>{stats.conversations}</Text>
                  <Text style={[styles.statLabel, { color: theme.textMuted }]}>次对话</Text>
                </View>
              )}
              {stats.memories > 0 && (
                <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Text style={[styles.statNum, { color: theme.accent }]}>{stats.memories}</Text>
                  <Text style={[styles.statLabel, { color: theme.textMuted }]}>条记忆</Text>
                </View>
              )}
              {stats.checkins > 0 && (
                <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Text style={[styles.statNum, { color: theme.accent }]}>{stats.checkins}</Text>
                  <Text style={[styles.statLabel, { color: theme.textMuted }]}>次签到</Text>
                </View>
              )}
              {recentMood && (
                <View style={[styles.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Text style={styles.statNum}>{recentMood}</Text>
                  <Text style={[styles.statLabel, { color: theme.textMuted }]}>最近心情</Text>
                </View>
              )}
            </View>
          )}

          <MoodCheckin theme={theme} />

          <DailyChallenges
            theme={theme}
            onStartBreathing={() => setShowBreathing(true)}
          />
        </>
      )}

      {/* Quick links - always visible */}
      <View style={styles.quickRow}>
        <QuickBtn emoji="💬" label="开始对话" theme={theme} onPress={() => router.push('/chat/new')} />
        <QuickBtn emoji="📊" label="情绪洞察" theme={theme} onPress={() => router.push('/insights')} />
        <QuickBtn emoji="🧠" label="记忆库" theme={theme} onPress={() => router.push('/memories')} />
        <QuickBtn emoji="📋" label="历史" theme={theme} onPress={() => router.push('/conversations')} />
      </View>

      {configured && (
        <TouchableOpacity
          style={[styles.breatheBtn, { backgroundColor: theme.accent + '15', borderColor: theme.accent + '30' }]}
          onPress={() => setShowBreathing(true)}
        >
          <Text style={{ fontSize: 20 }}>🫁</Text>
          <Text style={[styles.breatheText, { color: theme.accent }]}>呼吸练习</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={{ alignItems: 'center', marginBottom: 16 }}
        onPress={() => setShowThreeGoodThings((p) => !p)}
      >
        <Text style={{ color: theme.textMuted, fontSize: 14 }}>
          {showThreeGoodThings ? '收起' : '🌱 今天三件好事'}
        </Text>
      </TouchableOpacity>

      <ThreeGoodThings
        visible={showThreeGoodThings}
        onClose={() => setShowThreeGoodThings(false)}
        onSaved={() => {}}
        theme={theme}
      />

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
      style={[styles.quickBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
      onPress={onPress}
    >
      <Text style={styles.quickEmoji}>{emoji}</Text>
      <Text style={[styles.quickLabel, { color: theme.textSecondary }]}>{label}</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingTop: 48, paddingBottom: 100 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 },
  greeting: { fontSize: 14, fontWeight: '500', marginBottom: 4 },
  title: { fontSize: 28, fontWeight: '700' },
  tagline: { fontSize: 13, alignSelf: 'flex-end' },

  setupBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 16, padding: 18, borderWidth: 1,
    marginBottom: 24,
  },
  setupTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  setupDesc: { fontSize: 13, lineHeight: 18 },
  setupArrow: { fontSize: 28, fontWeight: '300' },

  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  statCard: {
    flex: 1, borderRadius: 14, padding: 12, alignItems: 'center',
    borderWidth: 1,
  },
  statNum: { fontSize: 20, fontWeight: '700' },
  statLabel: { fontSize: 11, marginTop: 2 },

  quickRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginBottom: 16 },
  quickBtn: {
    borderRadius: 14, padding: 16, alignItems: 'center', width: 78,
    borderWidth: 1,
  },
  quickEmoji: { fontSize: 26, marginBottom: 6 },
  quickLabel: { fontSize: 11, fontWeight: '500' },

  breatheBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, paddingHorizontal: 24,
    borderRadius: 16, borderWidth: 1, marginBottom: 12, alignSelf: 'stretch',
  },
  breatheText: { fontSize: 15, fontWeight: '600' },
})
