import { View, Text, FlatList, StyleSheet, TouchableOpacity, Alert, Share } from 'react-native'
import { useEffect, useState } from 'react'
import * as db from '../lib/db'
import { useTheme } from '../lib/theme-context'
import type { ThemeColors } from '../lib/theme'
import LearningBadge from '../components/learning-badge'
import MoodCalendar from '../components/mood-calendar'

type EmotionDistribution = { emotion: string; count: number; color: string }
type DayActivity = { day: string; count: number; label: string }

const EMOTION_COLORS: Record<string, string> = {
  anxiety: '#c97b5d',
  sadness: '#5d7bc9',
  anger: '#c95d5d',
  fear: '#8c5dc9',
  joy: '#5dc98c',
  gratitude: '#5dc9c9',
  calm: '#7bc95d',
  frustration: '#c9a85d',
  confused: '#a07bc9',
  hopeful: '#5d8cc9',
  lonely: '#8c8ca0',
  hurt: '#c95d7b',
}

const DAY_LABELS = ['日', '一', '二', '三', '四', '五', '六']

export default function InsightsScreen() {
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<db.Profile | null>(null)
  const [preferences, setPreferences] = useState<db.Preference[]>([])
  const [milestones, setMilestones] = useState<db.Memory[]>([])
  const [emotionDist, setEmotionDist] = useState<EmotionDistribution[]>([])
  const [weekActivity, setWeekActivity] = useState<DayActivity[]>([])
  const [stats, setStats] = useState({ conversations: 0, memories: 0 })
  const [weeklyMoods, setWeeklyMoods] = useState<{ day: string; emoji: string }[]>([])
  const [allCheckins, setAllCheckins] = useState<{ date: string; emoji: string }[]>([])
  const [patterns, setPatterns] = useState<{ keywords: string[]; emotion: string; count: number }[]>([])
  const [allMemories, setAllMemories] = useState<db.Memory[]>([])
  const { theme } = useTheme()

  useEffect(() => {
    (async () => {
      const p = await db.getProfile()
      setProfile(p)
      const prefs = await db.getPreferences()
      setPreferences(prefs)

      // Milestones
      const mems = await db.getMemories()
      const ms = mems.filter(m => m.category === 'milestone')
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      setMilestones(ms)

      // Emotion distribution from memories
      const emotionCounts: Record<string, number> = {}
      for (const m of mems) {
        if (m.emotion_tag) {
          emotionCounts[m.emotion_tag] = (emotionCounts[m.emotion_tag] || 0) + 1
        }
      }
      const dist = Object.entries(emotionCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([emotion, count]) => ({
          emotion,
          count,
          color: EMOTION_COLORS[emotion] || theme.accent,
        }))
      setEmotionDist(dist)

      // Weekly activity
      const convs = await db.getConversations()
      setStats({ conversations: convs.length, memories: mems.length })

      const now = new Date()
      const dayMap: Record<string, number> = {}
      const dayLabelMap: Record<string, string> = {}
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now)
        d.setDate(d.getDate() - i)
        const key = d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
        dayMap[key] = 0
        dayLabelMap[key] = DAY_LABELS[d.getDay()]
      }
      for (const conv of convs) {
        const d = new Date(conv.created_at)
        const key = d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
        if (key in dayMap) dayMap[key]++
      }
      const weekData = Object.entries(dayMap).map(([key, count]) => ({
        day: key,
        count,
        label: dayLabelMap[key],
      }))
      setWeekActivity(weekData)

      // Weekly moods from checkins
      const moods = await db.getMoodCheckins()
      const weekMoods: { day: string; emoji: string }[] = []
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now)
        d.setDate(d.getDate() - i)
        const key = d.toISOString().slice(0, 10)
        const found = moods.find(m => m.date === key)
        if (found) {
          weekMoods.push({ day: key, emoji: found.emoji })
        }
      }
      setWeeklyMoods(weekMoods)
      setAllCheckins(moods)
      setAllMemories(mems)

      // AI pattern discovery from topics
      const topics = await db.getTopics()
      const topicPatterns = topics
        .filter((t: { mention_count: number }) => t.mention_count > 1)
        .map((t: { keywords: string[]; last_emotion_state?: string; mention_count: number }) => ({
          keywords: t.keywords,
          emotion: t.last_emotion_state || "",
          count: t.mention_count,
        }))
      setPatterns(topicPatterns)

      setLoading(false)
    })()
  }, [])

  const s = createStyles(theme)

  if (loading) {
    return <View style={[s.loadingContainer, { backgroundColor: theme.background }]}>
      <Text style={s.loading}>加载中...</Text>
    </View>
  }
  const maxCount = Math.max(1, ...weekActivity.map(d => d.count))
  const maxEmotion = Math.max(1, ...emotionDist.map(e => e.count))

  const milestoneTypes: Record<string, string> = {
    self_discovery: '💡 自我发现',
    coping_success: '✅ 应对成功',
    positive_shift: '🌱 积极转变',
    pattern_break: '🔄 模式突破',
    new_perspective: '👀 新视角',
  }

  return (
    <FlatList
      style={[s.container, { backgroundColor: theme.background }]}
      contentContainerStyle={s.content}
      ListHeaderComponent={
        <>
          {/* 学习阶段 */}
          {profile && (
            <View style={s.section}>
              <LearningBadge stage={profile.learning_stage} interactionCount={profile.interaction_count} theme={theme} />
            </View>
          )}

          {/* Mood Calendar */}
          {allCheckins.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>情绪日历</Text>
              <Text style={s.sectionDesc}>过去 4 周的情绪记录</Text>
              <MoodCalendar checkins={allCheckins} theme={theme} />
            </View>
          )}

          {/* 本周心情签到 */}
          {weeklyMoods.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>本周心情</Text>
              <View style={s.moodChartRow}>
                {weeklyMoods.map((m, i) => {
                  const dayLabels = ['日', '一', '二', '三', '四', '五', '六']
                  const day = new Date()
                  day.setDate(day.getDate() - (6 - i))
                  return (
                    <View key={m.day} style={s.moodChartCol}>
                      <Text style={[s.moodChartEmoji, { color: theme.text }]}>{m.emoji}</Text>
                      <Text style={[s.moodChartDay, { color: theme.textMuted }]}>{dayLabels[day.getDay()]}</Text>
                    </View>
                  )
                })}
              </View>
            </View>
          )}

          {/* 数据概览卡片 */}
          <View style={s.statsRow}>
            <View style={[s.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[s.statNumber, { color: theme.accent }]}>{stats.conversations}</Text>
              <Text style={[s.statLabel, { color: theme.textMuted }]}>总对话</Text>
            </View>
            <View style={[s.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[s.statNumber, { color: theme.accentLight || theme.accent }]}>{stats.memories}</Text>
              <Text style={[s.statLabel, { color: theme.textMuted }]}>总记忆</Text>
            </View>
            <View style={[s.statCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[s.statNumber, { color: theme.success }]}>{milestones.length}</Text>
              <Text style={[s.statLabel, { color: theme.textMuted }]}>成长时刻</Text>
            </View>
          </View>

          {/* 本周简报 */}
          {stats.conversations > 0 && (
            <View style={s.section}>
              <View style={[s.weeklyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <View style={s.weeklyCardHeader}>
                  <Text style={[s.weeklyCardTitle, { color: theme.text }]}>📋 本周简报</Text>
                  <TouchableOpacity
                    style={[s.shareBtn, { backgroundColor: theme.surfaceLight }]}
                    onPress={() => Share.share({
                      message: `📋 本周简报\n\n对话 ${stats.conversations} 次 · 成长 ${milestones.length} 个 · ${emotionDist[0]?.emotion || '--'} · ${patterns.length > 0 ? patterns[0].keywords[0] || '--' : '--'}\n\n来自 雨声 App`,
                    })}
                  >
                    <Text style={[s.shareBtnText, { color: theme.textMuted }]}>分享</Text>
                  </TouchableOpacity>
                </View>
                <View style={s.weeklyGrid}>
                  <View style={s.weeklyItem}>
                    <Text style={[s.weeklyValue, { color: theme.accent }]}>{stats.conversations}</Text>
                    <Text style={[s.weeklyLabel, { color: theme.textMuted }]}>对话次数</Text>
                  </View>
                  <View style={s.weeklyItem}>
                    <Text style={[s.weeklyValue, { color: theme.success }]}>{milestones.length}</Text>
                    <Text style={[s.weeklyLabel, { color: theme.textMuted }]}>成长时刻</Text>
                  </View>
                  <View style={s.weeklyItem}>
                    <Text style={[s.weeklyValue, { color: theme.accentLight || theme.accent }]}>{emotionDist[0]?.emotion || '--'}</Text>
                    <Text style={[s.weeklyLabel, { color: theme.textMuted }]}>主要情绪</Text>
                  </View>
                  <View style={s.weeklyItem}>
                    <Text style={[s.weeklyValue, { color: theme.textSecondary }]}>{patterns.length > 0 ? patterns[0].keywords[0] || '--' : '--'}</Text>
                    <Text style={[s.weeklyLabel, { color: theme.textMuted }]}>高频话题</Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* 本周活动 */}
          {weekActivity.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>本周活动</Text>
              <View style={s.chartRow}>
                {weekActivity.map((d, i) => (
                  <View key={d.day} style={s.chartColumn}>
                    <View style={s.chartBarContainer}>
                      <View
                        style={[
                          s.chartBar,
                          {
                            height: `${(d.count / maxCount) * 100}%`,
                            backgroundColor: theme.accent,
                            opacity: d.count > 0 ? 1 : 0.3,
                          },
                        ]}
                      />
                    </View>
                    <Text style={[s.chartLabel, { color: theme.textMuted }]}>{d.label}</Text>
                    {d.count > 0 && <Text style={[s.chartValue, { color: theme.text }]}>{d.count}</Text>}
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* 情绪分布 */}
          {emotionDist.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>情绪分布</Text>
              <Text style={s.sectionDesc}>
                记忆中最常被标记的情绪
              </Text>
              {emotionDist.map((e) => (
                <View key={e.emotion} style={s.emotionRow}>
                  <Text style={[s.emotionLabel, { color: theme.textSecondary }]}>{e.emotion}</Text>
                  <View style={[s.emotionBarBg, { backgroundColor: theme.surfaceLight }]}>
                    <View
                      style={[
                        s.emotionBarFill,
                        {
                          width: `${(e.count / maxEmotion) * 100}%`,
                          backgroundColor: e.color,
                        },
                      ]}
                    />
                  </View>
                  <Text style={[s.emotionCount, { color: theme.textMuted }]}>{e.count}</Text>
                </View>
              ))}
            </View>
          )}

          {/* 偏好学习进度 */}
          {preferences.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>偏好学习进度</Text>
              {preferences.map(pref => {
                const confidence = pref.confidence || 0
                const barColor = confidence > 0.7 ? theme.success : confidence > 0.3 ? theme.accent : theme.textMuted
                return (
                  <View key={pref.dimension} style={s.prefRow}>
                    <Text style={s.prefName}>{pref.dimension}</Text>
                    <View style={[s.prefBarBg, { backgroundColor: theme.surfaceLight }]}>
                      <View style={[s.prefBarFill, { width: `${Math.round(confidence * 100)}%`, backgroundColor: barColor }]} />
                    </View>
                    <Text style={s.prefValue}>{pref.value} {Math.round(confidence * 100)}%</Text>
                  </View>
                )
              })}
            </View>
          )}

          {/* AI 模式发现 */}
          {patterns.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>AI 发现的模式</Text>
              <Text style={s.sectionDesc}>
                基于对话中反复出现的话题
              </Text>
              {patterns.slice(0, 5).map((p, i) => (
                <TouchableOpacity
                  key={i}
                  style={[s.patternCard, { backgroundColor: theme.surface, borderColor: theme.border, borderLeftColor: EMOTION_COLORS[p.emotion] || theme.accent }]}
                  onPress={() => {
                    const related = allMemories.filter(m =>
                      m.category !== 'milestone' &&
                      p.keywords.some(k => m.content.includes(k))
                    ).slice(0, 3)
                    Alert.alert(
                      `关于「${p.keywords[0] || ''}」`,
                      related.length > 0
                        ? related.map(m => `• ${m.content.slice(0, 80)}`).join('\n\n')
                        : '暂无关联记忆'
                    )
                  }}
                >
                  <View style={s.patternHeader}>
                    <Text style={[s.patternTitle, { color: theme.text }]}>
                      {p.keywords[0] || '话题'}{p.keywords.length > 1 ? `、${p.keywords.slice(1).join('、')}` : ''}
                    </Text>
                    {p.emotion && (
                      <Text style={[s.patternEmotion, { color: EMOTION_COLORS[p.emotion] || theme.textMuted }]}>
                        {p.emotion}
                      </Text>
                    )}
                  </View>
                  <Text style={[s.patternCount, { color: theme.textMuted }]}>
                    出现 {p.count} 次{p.keywords[0] ? ` · 点击查看关联记忆` : ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* 成长时间线 */}
          {milestones.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>🌱 成长时刻</Text>
              <Text style={s.sectionDesc}>
                已记录 {milestones.length} 个成长时刻
              </Text>
              <View style={s.milestoneGrid}>
                {milestones.slice(0, 6).map(m => {
                  const typeKey = m.emotion_tag || ''
                  const typeColors: Record<string, string> = {
                    self_discovery: '#5dc98c',
                    coping_success: '#5d8cc9',
                    positive_shift: '#c9a85d',
                    pattern_break: '#c97b5d',
                    new_perspective: '#7b5ea7',
                  }
                  const cardColor = typeColors[typeKey] || theme.accent
                  return (
                    <View key={m.id} style={[s.milestoneCard, { backgroundColor: theme.surface, borderColor: theme.border, borderLeftWidth: 3, borderLeftColor: cardColor }]}>
                      <Text style={s.milestoneType}>
                        {milestoneTypes[typeKey] || '📌 成长'}
                      </Text>
                      <Text style={s.milestoneDate}>
                        {new Date(m.created_at).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                      </Text>
                      <Text style={s.milestoneDesc} numberOfLines={3}>
                        {m.content}
                      </Text>
                    </View>
                  )
                })}
              </View>
              {milestones.length > 6 && (
                <Text style={{ color: theme.textMuted, fontSize: 13, textAlign: 'center', marginTop: 8 }}>
                  还有 {milestones.length - 6} 个成长时刻
                </Text>
              )}
            </View>
          )}

          {/* 空状态 */}
          {preferences.length === 0 && milestones.length === 0 && (
            <View style={s.empty}>
              <Text style={s.emptyTitle}>暂无洞察</Text>
              <Text style={s.emptyDesc}>
                开始对话后，AI 会自动学习你的偏好并记录成长时刻
              </Text>
            </View>
          )}
        </>
      }
      data={[]}
      renderItem={() => null}
    />
  )
}

function createStyles(theme: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1 },
    content: { padding: 24, paddingTop: 12 },
    loadingContainer: { flex: 1 },
    loading: { color: theme.textMuted, textAlign: 'center', marginTop: 80, fontSize: 15 },
    section: { marginBottom: 32 },
    sectionTitle: { fontSize: 20, fontWeight: '700', color: theme.text, marginBottom: 6 },
    sectionDesc: { fontSize: 13, color: theme.textMuted, marginBottom: 16 },
    empty: { alignItems: 'center', paddingTop: 80 },
    emptyTitle: { fontSize: 20, color: theme.text, fontWeight: '600' },
    emptyDesc: { fontSize: 14, color: theme.textMuted, marginTop: 8, textAlign: 'center' },

    // Stats row
    statsRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
    statCard: {
      flex: 1,
      borderRadius: 14,
      padding: 18,
      alignItems: 'center',
      borderWidth: 1,
    },
    statNumber: { fontSize: 26, fontWeight: '700' },
    statLabel: { fontSize: 12, marginTop: 4 },

    // Weekly chart
    chartRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 120, paddingTop: 20 },
    chartColumn: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' },
    chartBarContainer: { flex: 1, justifyContent: 'flex-end', width: '100%', alignItems: 'center' },
    chartBar: { width: 20, borderRadius: 4, minHeight: 4 },
    chartLabel: { fontSize: 11, marginTop: 4 },
    chartValue: { fontSize: 11, fontWeight: '600', marginTop: 2 },

    // Mood chart
    moodChartRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingVertical: 8 },
    moodChartCol: { alignItems: 'center', gap: 4 },
    moodChartEmoji: { fontSize: 28 },
    moodChartDay: { fontSize: 12 },

    // Emotion distribution
    emotionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
    emotionLabel: { fontSize: 13, width: 70 },
    emotionBarBg: { flex: 1, height: 10, borderRadius: 5, overflow: 'hidden' },
    emotionBarFill: { height: '100%', borderRadius: 5 },
    emotionCount: { fontSize: 12, width: 30, textAlign: 'right' },

    // Preferences
    prefRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
    prefName: { color: theme.textSecondary, fontSize: 13, width: 60 },
    prefBarBg: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
    prefBarFill: { height: '100%', borderRadius: 4 },
    prefValue: { color: theme.textMuted, fontSize: 11, width: 80, textAlign: 'right' },

    // Milestones
    milestoneGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    milestoneCard: {
      borderRadius: 14, padding: 14, marginBottom: 0, borderWidth: 1, width: '48%',
    },
    milestoneType: { color: theme.text, fontSize: 14, fontWeight: '600', marginBottom: 4 },
    milestoneDesc: { color: theme.textSecondary, fontSize: 13, lineHeight: 18, marginTop: 6 },
    milestoneDate: { color: theme.textMuted, fontSize: 11 },

    // Weekly summary
    weeklyCard: {
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
    },
    weeklyCardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    weeklyCardTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
    weeklyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    weeklyItem: { width: '45%', alignItems: 'center', padding: 8 },
    weeklyValue: { fontSize: 22, fontWeight: '700' },
    weeklyLabel: { fontSize: 12, marginTop: 4 },

    shareBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginLeft: 'auto' as const },
    shareBtnText: { fontSize: 12, fontWeight: '500' },

    // Pattern discovery
    patternCard: {
      borderRadius: 12,
      padding: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderLeftWidth: 4,
    },
    patternHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    patternTitle: { fontSize: 15, fontWeight: '600' },
    patternEmotion: { fontSize: 13, fontWeight: '500' },
    patternCount: { fontSize: 12 },
  })
}
