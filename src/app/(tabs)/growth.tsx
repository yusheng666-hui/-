import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { useEffect, useState } from 'react'
import { useTheme } from '../../lib/theme-context'
import MoodCalendar from '../../components/mood-calendar'
import LearningBadge from '../../components/learning-badge'
import * as db from '../../lib/db'

export default function GrowthTab() {
  const { theme } = useTheme()
  const [checkins, setCheckins] = useState<Array<{ date: string; emoji: string }>>([])
  const [stage, setStage] = useState('cold_start')
  const [interactionCount, setInteractionCount] = useState(0)

  useEffect(() => {
    (async () => {
      const [moodCheckins, profile] = await Promise.all([
        db.getMoodCheckins(),
        db.getProfile(),
      ])
      setCheckins(moodCheckins.map(c => ({ date: c.date, emoji: c.emoji })))
      setStage(profile.learning_stage || 'cold_start')
      setInteractionCount(profile.interaction_count || 0)
    })()
  }, [])

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={styles.container}
    >
      <Text style={[styles.title, { color: theme.text }]}>成长记录</Text>
      <Text style={[styles.subtitle, { color: theme.textMuted }]}>
        记录情绪轨迹，见证你的成长
      </Text>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>学习进度</Text>
        <LearningBadge stage={stage} interactionCount={interactionCount} theme={theme} />
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>情绪日历</Text>
        <MoodCalendar checkins={checkins} theme={theme} />
      </View>

      <View style={[styles.quoteBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={styles.quoteIcon}>✨</Text>
        <Text style={[styles.quoteText, { color: theme.textSecondary }]}>
          每一次情绪波动都是成长的契机
        </Text>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 48, paddingBottom: 100 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 6 },
  subtitle: { fontSize: 14, marginBottom: 28, lineHeight: 20 },
  section: { marginBottom: 28 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 14 },
  quoteBox: { borderRadius: 16, padding: 24, alignItems: 'center', borderWidth: 1 },
  quoteIcon: { fontSize: 32, marginBottom: 10 },
  quoteText: { fontSize: 14, fontStyle: 'italic', textAlign: 'center', lineHeight: 22 },
})
