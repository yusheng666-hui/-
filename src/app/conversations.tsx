import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, RefreshControl } from 'react-native'
import { useEffect, useState, useCallback } from 'react'
import { router } from 'expo-router'
import * as db from '../lib/db'
import { useTheme } from '../lib/theme-context'
import type { ThemeColors } from '../lib/theme'

export default function ConversationsScreen() {
  const [convs, setConvs] = useState<db.Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const { theme } = useTheme()

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    const list = await db.getConversations()
    list.sort((a, b) => {
      const at = new Date(a.created_at).getTime()
      const bt = new Date(b.created_at).getTime()
      return (isNaN(bt) ? 0 : bt) - (isNaN(at) ? 0 : at)
    })
    setConvs(list)
    setLoading(false)
    if (isRefresh) setRefreshing(false)
  }, [])

  useEffect(() => { loadData() }, [])

  const handleDelete = async (conv: db.Conversation) => {
    Alert.alert('删除对话', `确定要删除这条对话吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          await db.deleteConversation(conv.id)
          setConvs((prev) => prev.filter((c) => c.id !== conv.id))
        },
      },
    ])
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    if (diff < 86400000) return '今天'
    if (diff < 172800000) return '昨天'
    return `${d.getMonth() + 1}/${d.getDate()}`
  }

  const modeLabel: Record<string, string> = {
    chat: '💬 聊天',
    low_power: '🔋 低电量',
    emergency: '🫂 急救',
    journal: '📝 日志',
  }

  const s = makeStyles(theme)

  if (loading) {
    return (
      <View style={[s.container, { backgroundColor: theme.background }]}>
        <Text style={s.loading}>加载中...</Text>
      </View>
    )
  }

  if (convs.length === 0) {
    return (
      <View style={[s.container, { backgroundColor: theme.background }]}>
        <View style={s.empty}>
          <Text style={{ fontSize: 40, marginBottom: 16 }}>💬</Text>
          <Text style={[s.emptyTitle, { color: theme.text }]}>还没有对话</Text>
          <Text style={[s.emptyDesc, { color: theme.textMuted }]}>开始你的第一次倾诉吧</Text>
          <TouchableOpacity
            style={[s.startButton, { backgroundColor: theme.accent }]}
            onPress={() => router.push('/chat/new')}
          >
            <Text style={s.startText}>开始对话</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <View style={[s.container, { backgroundColor: theme.background }]}>
      <FlatList
        data={convs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} tintColor={theme.textMuted} />}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() => router.push(`/chat/${item.id}`)}
            onLongPress={() => handleDelete(item)}
            activeOpacity={0.7}
          >
            <View style={s.cardHeader}>
              <Text style={[s.modeTag, { color: theme.textSecondary }]}>
                {modeLabel[item.mode] || '💬 聊天'}
              </Text>
              <Text style={[s.date, { color: theme.textMuted }]}>{formatDate(item.created_at)}</Text>
            </View>
            {item.last_message && (
              <Text style={[s.preview, { color: theme.textSecondary }]} numberOfLines={2}>
                {item.last_message}
              </Text>
            )}
            <Text style={[s.rounds, { color: theme.textMuted }]}>
              已对话 {item.current_round} 轮
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  )
}

function makeStyles(theme: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1 },
    loading: { color: theme.textMuted, textAlign: 'center', marginTop: 80, fontSize: 15 },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
    emptyTitle: { fontSize: 20, fontWeight: '600' },
    emptyDesc: { fontSize: 14, marginTop: 8, textAlign: 'center' },
    startButton: { paddingHorizontal: 36, paddingVertical: 14, borderRadius: 14, marginTop: 24 },
    startText: { color: '#fff', fontWeight: '600', fontSize: 16 },
    list: { padding: 16, paddingTop: 12 },
    card: { borderRadius: 14, padding: 18, marginBottom: 12, borderWidth: 1 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
    modeTag: { fontSize: 14, fontWeight: '500' },
    date: { fontSize: 13 },
    preview: { fontSize: 15, lineHeight: 22 },
    rounds: { fontSize: 12, marginTop: 10, opacity: 0.6 },
  })
}
