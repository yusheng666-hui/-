import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, TextInput, RefreshControl, Share } from 'react-native'
import { useEffect, useState, useCallback } from 'react'
import * as db from '../lib/db'
import { useTheme } from '../lib/theme-context'
import type { ThemeColors } from '../lib/theme'

const CATEGORY_CONFIG: Record<string, { label: string; color: string }> = {
  trigger: { label: '触发源', color: '#c95d5d' },
  preference: { label: '偏好', color: '#c9a85d' },
  value: { label: '价值观', color: '#5dc98c' },
  coping_strategy: { label: '应对方式', color: '#c97b5d' },
  personality: { label: '性格特征', color: '#7b5ea7' },
  milestone: { label: '成长时刻', color: '#5dc98c' },
  general: { label: '其他', color: '#9a8a80' },
}

export default function MemoriesScreen() {
  const [memories, setMemories] = useState<db.Memory[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const { theme } = useTheme()

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    const list = await db.getMemories()
    list.sort((a, b) => b.weight - a.weight)
    setMemories(list)
    setLoading(false)
    if (isRefresh) setRefreshing(false)
  }, [])

  useEffect(() => { loadData() }, [])

  const handleDelete = async (id: string) => {
    Alert.alert('删除记忆', '确定要从记忆库中删除这条记录吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          await db.deleteMemory(id)
          setMemories((prev) => prev.filter((m) => m.id !== id))
        },
      },
    ])
  }

  const searchLower = searchQuery.toLowerCase().trim()
  const filtered = (filter ? memories.filter(m => m.category === filter) : memories)
    .filter(m => !searchLower || m.content.toLowerCase().includes(searchLower) || m.emotion_tag?.toLowerCase().includes(searchLower))

  const s = makeStyles(theme)

  return (
    <View style={[s.container, { backgroundColor: theme.background }]}>
      {/* Search bar */}
      <View style={s.searchRow}>
        <TextInput
          style={[s.searchInput, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="搜索记忆内容..."
          placeholderTextColor={theme.textMuted}
          autoCapitalize="none"
        />
      </View>

      {/* Filter chips */}
      <View style={s.filterRow}>
        <TouchableOpacity
          style={[s.filterChip, !filter ? { backgroundColor: theme.accent } : { backgroundColor: theme.surface, borderColor: theme.border }]}
          onPress={() => setFilter(null)}
        >
          <Text style={[s.filterText, !filter ? { color: '#fff' } : { color: theme.textMuted }]}>全部</Text>
        </TouchableOpacity>
        {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
          <TouchableOpacity
            key={key}
            style={[s.filterChip, filter === key ? { backgroundColor: cfg.color } : { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() => setFilter(key)}
          >
            <Text style={[s.filterText, filter === key ? { color: '#fff' } : { color: theme.textMuted }]}>
              {cfg.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <Text style={[s.loading, { color: theme.textMuted }]}>加载中...</Text>
      ) : filtered.length === 0 ? (
        <View style={s.empty}>
          <Text style={{ fontSize: 40, marginBottom: 16 }}>🧠</Text>
          <Text style={[s.emptyTitle, { color: theme.text }]}>记忆库还是空的</Text>
          <Text style={[s.emptyDesc, { color: theme.textMuted }]}>
            AI 会在对话中自动记录你的偏好和重要信息
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} tintColor={theme.textMuted} />}
          renderItem={({ item }) => {
            const cfg = CATEGORY_CONFIG[item.category] || { label: item.category, color: theme.accentMuted }
            return (
              <TouchableOpacity
                style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
                onLongPress={() => handleDelete(item.id)}
                activeOpacity={0.7}
              >
                <View style={s.cardHeader}>
                  <View style={[s.categoryTag, { backgroundColor: cfg.color + '22', borderColor: cfg.color }]}>
                    <Text style={[s.categoryText, { color: cfg.color }]}>{cfg.label}</Text>
                  </View>
                  {item.emotion_tag && (
                    <Text style={[s.emotionTag, { color: theme.textMuted }]}>{item.emotion_tag}</Text>
                  )}
                  <Text style={[s.weight, { color: theme.textMuted }]}>重要度 {item.weight}</Text>
                </View>
                <Text style={[s.content, { color: theme.text }]}>{item.content}</Text>
                <TouchableOpacity
                  style={[s.shareBtn, { backgroundColor: theme.surfaceLight }]}
                  onPress={() => Share.share({ message: `💭 ${item.content}` })}
                >
                  <Text style={[s.shareBtnText, { color: theme.textMuted }]}>分享</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            )
          }}
        />
      )}
    </View>
  )
}

function makeStyles(theme: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1 },
    searchRow: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
    searchInput: {
      borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12,
      fontSize: 15, borderWidth: 1,
    },
    filterRow: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 12, gap: 8, flexWrap: 'wrap' },
    filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, borderWidth: 1, borderColor: 'transparent' },
    filterText: { fontSize: 13 },
    loading: { textAlign: 'center', marginTop: 80, fontSize: 15 },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
    emptyTitle: { fontSize: 20, fontWeight: '600' },
    emptyDesc: { fontSize: 14, marginTop: 8, textAlign: 'center', opacity: 0.8 },
    list: { padding: 16, paddingTop: 4 },
    card: { borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1 },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    categoryTag: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
    categoryText: { fontSize: 12, fontWeight: '600' },
    emotionTag: { fontSize: 12 },
    weight: { fontSize: 12, marginLeft: 'auto', opacity: 0.6 },
    content: { fontSize: 15, lineHeight: 22 },
    shareBtn: { alignSelf: 'flex-end', marginTop: 10, paddingHorizontal: 14, paddingVertical: 5, borderRadius: 8 },
    shareBtnText: { fontSize: 13, fontWeight: '500' },
  })
}
