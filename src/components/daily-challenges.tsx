import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'

type Challenge = {
  id: string
  emoji: string
  title: string
  description: string
  xp: number
}

const POOL: Challenge[] = [
  { id: 'gratitude', emoji: '🙏', title: '写下三件感恩的事', description: '感恩之心能提升幸福感', xp: 30 },
  { id: 'walk', emoji: '🚶', title: '散步 10 分钟', description: '让身体和思绪一起放松', xp: 20 },
  { id: 'breathe', emoji: '🫁', title: '做一次深呼吸练习', description: '用呼吸平复情绪波动', xp: 25 },
  { id: 'journal', emoji: '📝', title: '写下今天的感受', description: '用文字梳理内心', xp: 25 },
  { id: 'music', emoji: '🎵', title: '听一首让你平静的歌', description: '音乐是最好的情绪调节剂', xp: 15 },
  { id: 'call', emoji: '📞', title: '联系一位朋友', description: '社交连接是情绪支柱', xp: 30 },
  { id: 'stretch', emoji: '🧘', title: '做 5 分钟伸展', description: '释放身体的紧张感', xp: 20 },
  { id: 'nature', emoji: '🌿', title: '看一眼窗外绿色', description: '自然是最好的疗愈师', xp: 15 },
  { id: 'smile', emoji: '😊', title: '对着镜子笑一笑', description: '表情会反过来影响心情', xp: 10 },
  { id: 'drink', emoji: '💧', title: '喝一杯水', description: '身体缺水会影响情绪', xp: 10 },
]

function getTodayKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

function hashSeed(seed: string): number {
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

function getDailyChallenges(): Challenge[] {
  const key = getTodayKey()
  const shuffled = [...POOL].sort((a, b) => {
    return hashSeed(key + a.id) - hashSeed(key + b.id)
  })
  return shuffled.slice(0, 3)
}

export default function DailyChallenges({
  theme,
  onStartBreathing,
}: {
  theme: any
  onStartBreathing?: () => void
}) {
  const [challenges] = useState<Challenge[]>(getDailyChallenges())
  const [completed, setCompleted] = useState<Set<string>>(new Set())
  const [xp, setXp] = useState(0)

  const toggle = (id: string, xpReward: number) => {
    setCompleted((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
        setXp((x) => Math.max(0, x - xpReward))
      } else {
        next.add(id)
        setXp((x) => x + xpReward)
      }
      return next
    })
  }

  const handlePress = (challenge: Challenge) => {
    if (challenge.id === 'breathe' && onStartBreathing && !completed.has('breathe')) {
      onStartBreathing()
    }
    toggle(challenge.id, challenge.xp)
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>今日挑战</Text>
        <View style={[styles.xpBadge, { backgroundColor: theme.accent + '20' }]}>
          <Text style={[styles.xpText, { color: theme.accent }]}>+{xp} XP</Text>
        </View>
      </View>

      {challenges.map((c) => {
        const done = completed.has(c.id)
        return (
          <TouchableOpacity
            key={c.id}
            style={[
              styles.card,
              {
                backgroundColor: done ? theme.accent + '15' : theme.surfaceLight,
                borderColor: done ? theme.accent + '40' : 'transparent',
              },
            ]}
            onPress={() => handlePress(c)}
            activeOpacity={0.7}
          >
            <View style={styles.cardLeft}>
              <Text style={styles.cardEmoji}>{c.emoji}</Text>
              <View style={styles.cardText}>
                <Text
                  style={[
                    styles.cardTitle,
                    {
                      color: done ? theme.accent : theme.text,
                      textDecorationLine: done ? 'line-through' : 'none',
                    },
                  ]}
                >
                  {c.title}
                </Text>
                <Text style={[styles.cardDesc, { color: theme.textMuted }]}>
                  {c.description}
                </Text>
              </View>
            </View>
            <View
              style={[
                styles.checkbox,
                {
                  borderColor: done ? theme.accent : theme.border,
                  backgroundColor: done ? theme.accent : 'transparent',
                },
              ]}
            >
              {done && <Text style={styles.checkmark}>✓</Text>}
            </View>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { marginBottom: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '700' },
  xpBadge: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4 },
  xpText: { fontSize: 13, fontWeight: '600' },
  card: { borderRadius: 14, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1 },
  cardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  cardEmoji: { fontSize: 28, marginRight: 12 },
  cardText: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  cardDesc: { fontSize: 12 },
  checkbox: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  checkmark: { color: '#fff', fontSize: 14, fontWeight: '700' },
})
