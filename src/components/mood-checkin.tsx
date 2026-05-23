// 每日心情签到组件

import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useState, useEffect } from 'react'
import * as db from '../lib/db'
import type { ThemeColors } from '../lib/theme'

type Props = {
  theme: ThemeColors
}

const MOOD_OPTIONS = [
  { emoji: '❤️', label: '难受' },
  { emoji: '😔', label: '有点丧' },
  { emoji: '😐', label: '一般般' },
  { emoji: '😊', label: '还不错' },
  { emoji: '🤗', label: '很赞' },
  { emoji: '😤', label: '烦躁' },
]

export default function MoodCheckin({ theme }: Props) {
  const [todayMood, setTodayMood] = useState<string | null>(null)
  const [streak, setStreak] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    loadToday()
  }, [])

  const calcStreak = (checkins: db.MoodCheckin[], todayStr: string) => {
    const dateSet = new Set(checkins.map(c => c.date))
    let count = 0
    for (let i = 0; i < 365; i++) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      if (dateSet.has(key)) {
        count++
      } else if (i !== 0) {
        break
      }
    }
    return count
  }

  const loadToday = async () => {
    const checkins = await db.getMoodCheckins()
    const today = new Date().toISOString().slice(0, 10)
    const todayCheck = checkins.find(c => c.date === today)
    if (todayCheck) {
      setTodayMood(todayCheck.emoji)
    }
    setStreak(calcStreak(checkins, today))
  }

  const handleSelect = async (emoji: string) => {
    const today = new Date().toISOString().slice(0, 10)
    await db.saveMoodCheckin({ date: today, emoji })
    setTodayMood(emoji)
    const checkins = await db.getMoodCheckins()
    let streakCount = 0
    const now = new Date()
    for (let i = 0; i < 365; i++) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      const found = checkins.find(c => c.date === key)
      if (found) {
        streakCount++
      } else {
        if (i === 0) continue
        break
      }
    }
    setStreak(streakCount)
    await db.saveStreak(streakCount)
  }

  if (!visible) return null

  const s = makeStyles(theme)

  return (
    <View style={[s.container, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={s.headerRow}>
        <Text style={s.title}>今天感觉怎么样?</Text>
        <TouchableOpacity onPress={() => setVisible(false)}>
          <Text style={[s.closeBtn, { color: theme.textMuted }]}>✕</Text>
        </TouchableOpacity>
      </View>

      {todayMood ? (
        <View style={s.doneRow}>
          <Text style={s.doneEmoji}>{todayMood}</Text>
          {streak > 0 && (
            <Text style={[s.streakText, { color: theme.accent }]}>
              🔥 连续签到 {streak} 天
            </Text>
          )}
        </View>
      ) : (
        <View style={s.moodRow}>
          {MOOD_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.emoji}
              style={[s.moodBtn, { backgroundColor: theme.surfaceLight }]}
              onPress={() => handleSelect(opt.emoji)}
            >
              <Text style={s.moodEmoji}>{opt.emoji}</Text>
              <Text style={[s.moodLabel, { color: theme.textSecondary }]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  )
}

function makeStyles(theme: ThemeColors) {
  return StyleSheet.create({
    container: {
      borderRadius: 14,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    title: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
    },
    closeBtn: {
      fontSize: 16,
      padding: 4,
    },
    moodRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    moodBtn: {
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 6,
      borderRadius: 12,
      minWidth: 54,
    },
    moodEmoji: {
      fontSize: 26,
      marginBottom: 4,
    },
    moodLabel: {
      fontSize: 11,
    },
    doneRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    doneEmoji: {
      fontSize: 28,
    },
    streakText: {
      fontSize: 14,
      fontWeight: '600',
    },
  })
}
