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
      <View style={[s.filterRow, { backgroundColor: theme.background }]}>
        <TouchableOpacity
          style={[s.filterChip, { backgroundColor: theme.surface }, !filter && { backgroundColor: theme.accent }]}
          onPress={() => setFilter(null)}
        >
          <Text style={[s.filterText, { color: theme.textMuted }, !filter && { color: '#fff' }]}>全部</Text>
        </TouchableOpacity>
        {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
          <TouchableOpacity
            key={key}
            style={[s.filterChip, { backgroundColor: theme.surface }, filter === key && { backgroundColor: cfg.color }]}
            onPress={() => setFilter(key)}
          >
            <Text style={[s.filterText, { color: theme.textMuted }, filter === key && { color: '#fff' }]}>
              {cfg.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 搜索框 */}
      <TextInput
        style={[s.searchInput, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="搜索记忆内容..."
        placeholderTextColor={theme.textMuted}
        autoCapitalize="none"
      />

      {loading ? (
        <Text style={s.loading}>加载中...</Text>
      ) : filtered.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyTitle}>记忆库还是空的</Text>
          <Text style={s.emptyDesc}>
            AI 会在对话中自动记录你的偏好和重要信息
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} tintColor={'#888'} />}
          renderItem={({ item }) => {
            const cfg = CATEGORY_CONFIG[item.category] || { label: item.category, color: theme.accentMuted }
            return (
              <TouchableOpacity
                style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 }]}
                onLongPress={() => handleDelete(item.id)}
              >
                <View style={s.cardHeader}>
                  <View style={[s.categoryTag, { backgroundColor: cfg.color + '22', borderColor: cfg.color }]}>
                    <Text style={[s.categoryText, { color: cfg.color }]}>{cfg.label}</Text>
                  </View>
                  {item.emotion_tag && (
                    <Text style={s.emotionTag}>{item.emotion_tag}</Text>
                  )}
                  <Text style={s.weight}>重要度 {item.weight}</Text>
                </View>
                <Text style={s.content}>{item.content}</Text>

                {/* 分享按钮 */}
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
    filterRow: { flexDirection: 'row', padding: 12, paddingBottom: 0, gap: 8, flexWrap: 'wrap' },
    searchInput: {
      marginHorizontal: 12,
      marginBottom: 8,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 14,
      borderWidth: 1,
    },
    filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
    filterText: { fontSize: 13 },
    loading: { color: theme.textMuted, textAlign: 'center', marginTop: 40 },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
    emptyTitle: { fontSize: 18, color: theme.textMuted, fontWeight: '600' },
    emptyDesc: { fontSize: 14, color: theme.textMuted, marginTop: 8, textAlign: 'center', opacity: 0.8 },
    list: { padding: 16 },
    card: { borderRadius: 12, padding: 16, marginBottom: 12 },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    categoryTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, borderWidth: 1 },
    categoryText: { fontSize: 11, fontWeight: '600' },
    emotionTag: { color: theme.textMuted, fontSize: 12 },
    weight: { color: theme.textMuted, fontSize: 12, marginLeft: 'auto', opacity: 0.6 },
    content: { color: theme.text, fontSize: 15, lineHeight: 22 },
    shareBtn: { alignSelf: 'flex-end', marginTop: 8, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8 },
    shareBtnText: { fontSize: 12, fontWeight: '500' },
  })
}
