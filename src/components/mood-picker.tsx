// 情绪速记 - 全屏沉浸式表情选择器

import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useState } from 'react'
import * as db from '../lib/db'
import type { ThemeColors } from '../lib/theme'

type Props = {
  visible: boolean
  onClose: () => void
  theme: ThemeColors
}

const MOODS = [
  { emoji: '❤️', label: '难受', color: '#c95d5d' },
  { emoji: '😔', label: '有点丧', color: '#5d7bc9' },
  { emoji: '😐', label: '一般般', color: '#9a9288' },
  { emoji: '😊', label: '还不错', color: '#5dc98c' },
  { emoji: '🤗', label: '很赞', color: '#4a9e6a' },
  { emoji: '😤', label: '烦躁', color: '#c9a85d' },
]

export default function MoodPicker({ visible, onClose, theme }: Props) {
  const [saving, setSaving] = useState<string | null>(null)

  const handleSelect = async (emoji: string) => {
    setSaving(emoji)
    const today = new Date().toISOString().slice(0, 10)
    await db.saveMoodCheckin({ date: today, emoji })
    setTimeout(() => {
      setSaving(null)
      onClose()
    }, 600)
  }

  const s = makeStyles(theme)

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={[s.card, { backgroundColor: theme.surface }]}>
          <Text style={[s.title, { color: theme.text }]}>现在感觉怎么样?</Text>
          <Text style={[s.subtitle, { color: theme.textMuted }]}>点一下就好，不用说话</Text>

          <View style={s.grid}>
            {MOODS.map(m => (
              <TouchableOpacity
                key={m.emoji}
                style={[
                  s.moodBtn,
                  { backgroundColor: theme.surfaceLight },
                  saving === m.emoji && { backgroundColor: m.color + '33' },
                ]}
                onPress={() => handleSelect(m.emoji)}
                disabled={saving !== null}
              >
                <Text style={[s.emoji, saving === m.emoji && { transform: [{ scale: 1.3 }] }]}>
                  {saving === m.emoji ? '✅' : m.emoji}
                </Text>
                <Text style={[s.label, { color: theme.textSecondary }]}>{m.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity onPress={onClose} style={s.cancelBtn}>
            <Text style={{ color: theme.textMuted, fontSize: 14 }}>关闭</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

function makeStyles(theme: ThemeColors) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.5)',
      padding: 24,
    },
    card: {
      borderRadius: 20,
      padding: 24,
      width: '100%',
      maxWidth: 340,
      alignItems: 'center',
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 13,
      marginBottom: 24,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: 12,
    },
    moodBtn: {
      width: 80,
      height: 90,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emoji: {
      fontSize: 34,
      marginBottom: 6,
    },
    label: {
      fontSize: 11,
    },
    cancelBtn: {
      marginTop: 20,
      padding: 8,
    },
  })
}
