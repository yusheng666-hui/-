// 今天三件好事 — 积极心理学练习

import { useState, useEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native'
import * as db from '../lib/db'
import type { ThemeColors } from '../lib/theme'

type Props = {
  visible: boolean
  onClose: () => void
  onSaved: () => void
  theme: ThemeColors
}

export default function ThreeGoodThings({ visible, onClose, onSaved, theme }: Props) {
  const [items, setItems] = useState<string[]>(['', '', ''])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [existing, setExisting] = useState<db.GratitudeEntry | null>(null)

  useEffect(() => {
    if (visible) {
      db.getTodayGratitude().then(entry => {
        if (entry) {
          setExisting(entry)
          setItems(entry.items)
          setSaved(true)
        } else {
          setExisting(null)
          setItems(['', '', ''])
          setSaved(false)
        }
      })
    }
  }, [visible])

  const handleSave = async () => {
    const filled = items.filter(i => i.trim().length > 0)
    if (filled.length === 0) return
    setSaving(true)
    await db.saveGratitudeEntry({
      date: new Date().toISOString().slice(0, 10),
      items: filled,
    })
    setSaved(true)
    setSaving(false)
    onSaved()
  }

  const updateItem = (index: number, text: string) => {
    const next = [...items]
    next[index] = text
    setItems(next)
  }

  if (!visible) return null

  const s = makeStyles(theme)

  return (
    <View style={[s.container, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={s.headerRow}>
        <Text style={[s.title, { color: theme.text }]}>🌱 今天三件好事</Text>
        <TouchableOpacity onPress={onClose}>
          <Text style={{ color: theme.textMuted, fontSize: 16 }}>✕</Text>
        </TouchableOpacity>
      </View>
      <Text style={[s.desc, { color: theme.textMuted }]}>
        写下今天发生的三件好事——哪怕是特别小的事
      </Text>

      {saved && existing ? (
        <View style={s.doneView}>
          {existing.items.map((item, i) => (
            <View key={i} style={[s.itemRow, { backgroundColor: theme.surfaceLight }]}>
              <Text style={[s.itemNum, { color: theme.accent }]}>{i + 1}</Text>
              <Text style={[s.itemText, { color: theme.text }]}>{item}</Text>
            </View>
          ))}
          <TouchableOpacity
            style={[s.editBtn, { borderColor: theme.border }]}
            onPress={() => setSaved(false)}
          >
            <Text style={{ color: theme.textMuted, fontSize: 13 }}>修改</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={s.inputArea}>
          {[0, 1, 2].map(i => (
            <TextInput
              key={i}
              style={[s.input, { backgroundColor: theme.surfaceLight, color: theme.text, borderColor: theme.border }]}
              placeholder={`第 ${i + 1} 件好事...`}
              placeholderTextColor={theme.textMuted}
              value={items[i]}
              onChangeText={t => updateItem(i, t)}
              maxLength={200}
            />
          ))}
          <View style={s.btnRow}>
            <TouchableOpacity
              style={[s.saveBtn, { backgroundColor: theme.accent }]}
              onPress={handleSave}
              disabled={saving || items.filter(i => i.trim().length > 0).length === 0}
            >
              <Text style={s.saveBtnText}>{saving ? '保存中...' : '记录今天的好事'}</Text>
            </TouchableOpacity>
          </View>
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
      marginBottom: 8,
    },
    title: {
      fontSize: 16,
      fontWeight: '600',
    },
    desc: {
      fontSize: 13,
      marginBottom: 16,
    },
    inputArea: {
      gap: 10,
    },
    input: {
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 14,
      borderWidth: 1,
    },
    btnRow: {
      alignItems: 'center',
      marginTop: 4,
    },
    saveBtn: {
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 12,
    },
    saveBtnText: {
      color: '#fff',
      fontWeight: '600',
      fontSize: 14,
    },
    doneView: {
      gap: 8,
    },
    itemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 10,
      padding: 12,
      gap: 10,
    },
    itemNum: {
      fontSize: 16,
      fontWeight: '700',
      minWidth: 20,
    },
    itemText: {
      fontSize: 14,
      lineHeight: 20,
      flex: 1,
    },
    editBtn: {
      alignItems: 'center',
      paddingVertical: 8,
      borderWidth: 1,
      borderRadius: 8,
    },
  })
}
