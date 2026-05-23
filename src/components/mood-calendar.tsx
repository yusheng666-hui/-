// 情绪日历 — GitHub 风格 4 周热力图

import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useState } from 'react'
import type { ThemeColors } from '../lib/theme'

const MOOD_COLORS: Record<string, string> = {
  '❤️': '#c95d5d',
  '😔': '#7b9cc9',
  '😐': '#b0a898',
  '😊': '#7bc97b',
  '🤗': '#4aae6a',
  '😤': '#c9a85d',
}

const MOOD_LABELS: Record<string, string> = {
  '❤️': '难受',
  '😔': '有点丧',
  '😐': '一般般',
  '😊': '还不错',
  '🤗': '很赞',
  '😤': '烦躁',
}

type Props = {
  checkins: Array<{ date: string; emoji: string }>
  theme: ThemeColors
  onDayPress?: (date: string) => void
}

export default function MoodCalendar({ checkins, theme, onDayPress }: Props) {
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const checkinMap = new Map(checkins.map(c => [c.date, c.emoji]))

  const today = new Date()
  const weeks: Array<Array<{ date: string; day: number }>> = []

  // Build 4 weeks of days
  for (let w = 27; w >= 0; w -= 7) {
    const week: Array<{ date: string; day: number }> = []
    for (let d = 6; d >= 0; d--) {
      const date = new Date(today)
      date.setDate(date.getDate() - (w + d))
      const key = date.toISOString().slice(0, 10)
      week.push({ date: key, day: date.getDate() })
    }
    weeks.push(week)
  }

  const s = makeStyles(theme)

  return (
    <View style={s.container}>
      <View style={s.grid}>
        {weeks.map((week, wi) => (
          <View key={wi} style={s.weekRow}>
            {week.map((day, di) => {
              const emoji = checkinMap.get(day.date)
              const color = emoji ? MOOD_COLORS[emoji] || '#444' : 'transparent'
              const isSelected = selectedDay === day.date
              return (
                <TouchableOpacity
                  key={day.date}
                  style={[
                    s.dayCell,
                    { backgroundColor: color, borderColor: isSelected ? theme.accent : 'transparent' },
                    !emoji && { backgroundColor: theme.surfaceLight, opacity: 0.3 },
                  ]}
                  onPress={() => {
                    setSelectedDay(isSelected ? null : day.date)
                    if (emoji) onDayPress?.(day.date)
                  }}
                />
              )
            })}
          </View>
        ))}
      </View>

      {/* 图例 */}
      <View style={s.legend}>
        <View style={[s.legendDot, { backgroundColor: theme.surfaceLight, opacity: 0.3 }]} />
        <Text style={[s.legendLabel, { color: theme.textMuted }]}>无记录</Text>
        {['❤️', '😔', '😐', '😊', '🤗', '😤'].map(emoji => (
          <View key={emoji} style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: MOOD_COLORS[emoji] }]} />
            <Text style={[s.legendLabel, { color: theme.textMuted }]}>{MOOD_LABELS[emoji]}</Text>
          </View>
        ))}
      </View>

      {selectedDay && checkinMap.has(selectedDay) && (
        <Text style={{ color: theme.textSecondary, fontSize: 13, marginTop: 8, textAlign: 'center' }}>
          {selectedDay.slice(5)} {MOOD_LABELS[checkinMap.get(selectedDay) || ''] || ''}
        </Text>
      )}

      <Text style={{ color: theme.textMuted, fontSize: 12, textAlign: 'center', marginTop: 8 }}>
        本月已签到 {checkins.filter(c => c.date.slice(0, 7) === today.toISOString().slice(0, 7)).length} 天
      </Text>
    </View>
  )
}

function makeStyles(theme: ThemeColors) {
  return StyleSheet.create({
    container: {
      marginVertical: 8,
    },
    grid: {
      gap: 4,
    },
    weekRow: {
      flexDirection: 'row',
      gap: 4,
    },
    dayCell: {
      width: 32,
      height: 32,
      borderRadius: 6,
      borderWidth: 2,
    },
    legend: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 12,
      alignItems: 'center',
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    legendDot: {
      width: 10,
      height: 10,
      borderRadius: 3,
    },
    legendLabel: {
      fontSize: 11,
    },
  })
}