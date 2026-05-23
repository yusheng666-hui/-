import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, Share, Platform, RefreshControl } from 'react-native'
import { useEffect, useState, useCallback } from 'react'
import * as db from '../lib/db'
import { useTheme } from '../lib/theme-context'
import type { ThemeColors } from '../lib/theme'

const OUTPUT_TYPE_CONFIG: Record<string, { label: string; icon: string }> = {
  draft_reply: { label: '回信草稿', icon: '✉️' },
  decision_card: { label: '决策分析卡', icon: '📋' },
  journal: { label: '日记草稿', icon: '📓' },
  letter: { label: '感谢信/道歉信', icon: '💌' },
  emotion_card: { label: '情绪卡片', icon: '🎴' },
  conversation_export: { label: '对话摘要导出', icon: '📄' },
  draft: { label: '草稿', icon: '📝' },
}

export default function OutputsScreen() {
  const [items, setItems] = useState<db.GeneratedOutput[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const { theme } = useTheme()

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    const list = await db.getGeneratedOutputs()
    list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    setItems(list)
    setLoading(false)
    if (isRefresh) setRefreshing(false)
  }, [])

  useEffect(() => { loadData() }, [])

  const handleSave = async (id: string) => {
    await db.updateGeneratedOutput(id, { status: 'saved' })
    setItems(prev => prev.map(i => i.id === id ? { ...i, status: 'saved' } : i))
  }

  const handleDelete = (id: string) => {
    Alert.alert('删除', '确定要删除这条产出吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          await db.deleteGeneratedOutput(id)
          setItems(prev => prev.filter(i => i.id !== id))
        },
      },
    ])
  }

  const handleExport = async (item: db.GeneratedOutput) => {
    try {
      const text = `${item.title}\n\n${item.content}`
      if (Platform.OS === 'web') {
        await navigator.clipboard.writeText(text)
        Alert.alert('已复制', '内容已复制到剪贴板')
      } else {
        await Share.share({ message: text })
      }
    } catch {}
  }

  const s = makeStyles(theme)

  return (
    <View style={[s.container, { backgroundColor: theme.background }]}>
      {loading ? (
        <Text style={s.loading}>加载中...</Text>
      ) : items.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyTitle}>还没有产出</Text>
          <Text style={s.emptyDesc}>
            AI 会在对话中帮你生成回信、决策分析、日记等草稿
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => item.id}
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} tintColor={'#888'} />}
          renderItem={({ item }) => {
            const cfg = OUTPUT_TYPE_CONFIG[item.output_type] || { label: item.output_type, icon: '📄' }
            const isExpanded = expandedId === item.id
            return (
              <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 }]}>
                <TouchableOpacity onPress={() => setExpandedId(isExpanded ? null : item.id)}>
                  <View style={s.cardHeader}>
                    <View style={s.cardTitleRow}>
                      <Text style={s.cardIcon}>{cfg.icon}</Text>
                      <View>
                        <Text style={s.cardTitle}>{item.title}</Text>
                        <Text style={s.cardType}>{cfg.label}</Text>
                      </View>
                    </View>
                    <Text style={[s.statusBadge, {
                      color: item.status === 'saved' ? theme.success : theme.textMuted,
                    }]}>
                      {item.status === 'saved' ? '已保存' : '草稿'}
                    </Text>
                  </View>
                  <Text style={s.cardContent} numberOfLines={isExpanded ? undefined : 3}>
                    {item.content}
                  </Text>
                  <Text style={s.cardDate}>
                    {new Date(item.created_at).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </TouchableOpacity>

                {/* 操作按钮 */}
                <View style={[s.actionRow, { borderTopColor: theme.border }]}>
                  {item.status === 'draft' && (
                    <TouchableOpacity style={[s.actionBtn, { backgroundColor: theme.success + '22' }]} onPress={() => handleSave(item.id)}>
                      <Text style={[s.actionBtnText, { color: theme.success }]}>保存</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={[s.actionBtn, { backgroundColor: theme.surfaceLight }]} onPress={() => handleExport(item)}>
                    <Text style={[s.actionBtnText, { color: theme.textSecondary }]}>导出</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.actionBtn, { backgroundColor: theme.danger + '22' }]} onPress={() => handleDelete(item.id)}>
                    <Text style={[s.actionBtnText, { color: theme.danger }]}>删除</Text>
                  </TouchableOpacity>
                </View>
              </View>
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
    loading: { color: theme.textMuted, textAlign: 'center', marginTop: 40 },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
    emptyTitle: { fontSize: 18, color: theme.textMuted, fontWeight: '600' },
    emptyDesc: { fontSize: 14, color: theme.textMuted, marginTop: 8, textAlign: 'center', opacity: 0.8 },
    list: { padding: 16 },
    card: { borderRadius: 12, padding: 16, marginBottom: 12 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
    cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
    cardIcon: { fontSize: 20 },
    cardTitle: { color: theme.text, fontSize: 16, fontWeight: '600' },
    cardType: { color: theme.textMuted, fontSize: 12, marginTop: 2 },
    statusBadge: { fontSize: 12, fontWeight: '600' },
    cardContent: { color: theme.textSecondary, fontSize: 14, lineHeight: 20 },
    cardDate: { color: theme.textMuted, fontSize: 11, marginTop: 8 },
    actionRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
    },
    actionBtn: {
      paddingHorizontal: 16,
      paddingVertical: 6,
      borderRadius: 8,
    },
    actionBtnText: {
      fontSize: 13,
      fontWeight: '600',
    },
  })
}
