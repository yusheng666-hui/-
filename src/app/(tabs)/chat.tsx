import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native'
import { router } from 'expo-router'
import { useTheme } from '../../lib/theme-context'

const FEATURES = [
  { emoji: '🎤', title: '语音输入', desc: '说话比打字更轻松' },
  { emoji: '🔊', title: '语音朗读', desc: 'AI 回复可以读给你听' },
  { emoji: '🖼', title: '图片分享', desc: '分享你的生活瞬间' },
  { emoji: '😊', title: '心情标记', desc: '记录每次对话时的心情' },
  { emoji: '🫂', title: '急救模式', desc: '紧急情况下的即时支持' },
  { emoji: '📓', title: '日记模式', desc: '安静书写，自我梳理' },
]

export default function ChatTab() {
  const { theme } = useTheme()

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={styles.container}
    >
      <Text style={[styles.icon]}>💬</Text>
      <Text style={[styles.title, { color: theme.text }]}>AI 情绪陪伴</Text>
      <Text style={[styles.desc, { color: theme.textMuted }]}>
        随时随地，我都在这里倾听你
      </Text>

      <TouchableOpacity
        style={[styles.btn, { backgroundColor: theme.accent }]}
        onPress={() => router.push('/chat/new')}
      >
        <Text style={styles.btnText}>开始对话</Text>
      </TouchableOpacity>

      <View style={styles.featureGrid}>
        {FEATURES.map((f) => (
          <View key={f.title} style={[styles.featureCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={styles.featureEmoji}>{f.emoji}</Text>
            <Text style={[styles.featureTitle, { color: theme.text }]}>{f.title}</Text>
            <Text style={[styles.featureDesc, { color: theme.textMuted }]}>{f.desc}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={styles.linkBtn}
        onPress={() => router.push('/conversations')}
      >
        <Text style={[styles.linkText, { color: theme.accent }]}>查看历史对话</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 48, paddingBottom: 100, alignItems: 'center' },
  icon: { fontSize: 48, marginBottom: 12 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  desc: { fontSize: 15, marginBottom: 24, textAlign: 'center' },
  btn: { paddingHorizontal: 40, paddingVertical: 16, borderRadius: 16, marginBottom: 28, width: '100%', alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  featureGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginBottom: 20 },
  featureCard: {
    width: '30%', borderRadius: 14, padding: 14, alignItems: 'center',
    borderWidth: 1, aspectRatio: 1.3, justifyContent: 'center',
  },
  featureEmoji: { fontSize: 28, marginBottom: 6 },
  featureTitle: { fontSize: 13, fontWeight: '600', marginBottom: 2, textAlign: 'center' },
  featureDesc: { fontSize: 10, textAlign: 'center' },
  linkBtn: { padding: 8 },
  linkText: { fontSize: 14, fontWeight: '500' },
})
