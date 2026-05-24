import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { useTheme } from '../../lib/theme-context'
import MoodCalendar from '../../components/mood-calendar'
import LearningBadge from '../../components/learning-badge'

export default function GrowthTab() {
  const { theme } = useTheme()

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
        <Text style={[styles.sectionTitle, { color: theme.text }]}>情绪日历</Text>
        <MoodCalendar theme={theme} />
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>学习勋章</Text>
        <LearningBadge theme={theme} />
      </View>

      <View style={[styles.quoteBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.quoteIcon]}>✨</Text>
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
  subtitle: { fontSize: 14, marginBottom: 28 },
  section: { marginBottom: 28 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  quoteBox: { borderRadius: 16, padding: 20, alignItems: 'center', borderWidth: 1 },
  quoteIcon: { fontSize: 28, marginBottom: 8 },
  quoteText: { fontSize: 14, fontStyle: 'italic', textAlign: 'center' },
})
