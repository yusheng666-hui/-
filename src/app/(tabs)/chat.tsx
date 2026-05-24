import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { useTheme } from '../../lib/theme-context'

export default function ChatTab() {
  const { theme } = useTheme()

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.icon]}>💬</Text>
      <Text style={[styles.title, { color: theme.text }]}>AI 情绪陪伴</Text>
      <Text style={[styles.desc, { color: theme.textMuted }]}>
        随时随地，我都在这里倾听你
      </Text>

      <TouchableOpacity
        style={[styles.btn, { backgroundColor: theme.accent }]}
        onPress={() => router.push('/chat/new')}
      >
        <Text style={styles.btnText}>开始新对话</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.linkBtn]}
        onPress={() => router.push('/conversations')}
      >
        <Text style={[styles.linkText, { color: theme.accent }]}>查看历史对话</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  icon: { fontSize: 64, marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  desc: { fontSize: 15, marginBottom: 32, textAlign: 'center' },
  btn: { paddingHorizontal: 40, paddingVertical: 16, borderRadius: 16, marginBottom: 16, width: '100%', alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  linkBtn: { padding: 8 },
  linkText: { fontSize: 14, fontWeight: '500' },
})
