import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native'
import { useState } from 'react'
import type { ThemeColors } from '../lib/theme'

type Mode = 'chat' | 'low_power' | 'emergency' | 'journal'

type Props = {
  currentMode: Mode
  onSelect: (mode: Mode) => void
  theme?: ThemeColors
}

const MODES: Array<{ key: Mode; label: string; desc: string; icon: string }> = [
  { key: 'chat', label: '正常聊天', desc: '完整分析 + 学习', icon: '💬' },
  { key: 'low_power', label: '低电量模式', desc: '极简回复，上限 3 轮', icon: '🔋' },
  { key: 'emergency', label: '急救模式', desc: '不分析，只承接', icon: '🫂' },
  { key: 'journal', label: '日志模式', desc: '记录想法，AI 不回复', icon: '📝' },
]

export default function ModeSelector({ currentMode, onSelect, theme }: Props) {
  const [open, setOpen] = useState(false)
  const s = makeStyles(theme)
  const current = MODES.find((m) => m.key === currentMode)

  return (
    <>
      <TouchableOpacity style={[s.trigger, { backgroundColor: theme?.surface || '#16213e' }]} onPress={() => setOpen(true)}>
        <Text style={s.triggerText}>
          {current?.icon} {current?.label || '聊天'}
        </Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade">
        <TouchableOpacity
          style={s.overlay}
          activeOpacity={1}
          onPress={() => setOpen(false)}
        >
          <View style={[s.sheet, { backgroundColor: theme?.background || '#1a1a2e' }]}>
            <Text style={s.title}>选择对话模式</Text>
            {MODES.map((m) => (
              <TouchableOpacity
                key={m.key}
                style={[
                  s.option,
                  m.key === currentMode && {
                    backgroundColor: theme?.surface || '#16213e',
                    borderColor: theme?.accent || '#533483',
                  },
                ]}
                onPress={() => {
                  onSelect(m.key)
                  setOpen(false)
                }}
              >
                <Text style={s.optionIcon}>{m.icon}</Text>
                <View style={s.optionText}>
                  <Text style={s.optionLabel}>{m.label}</Text>
                  <Text style={s.optionDesc}>{m.desc}</Text>
                </View>
                {m.key === currentMode && <Text style={[s.check, { color: theme?.accent || '#533483' }]}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  )
}

function makeStyles(theme?: ThemeColors) {
  return StyleSheet.create({
    trigger: {
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 6,
    },
    triggerText: {
      color: theme?.textSecondary || '#ccc',
      fontSize: 13,
      fontWeight: '500',
    },
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'flex-end',
    },
    sheet: {
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 24,
      paddingBottom: 40,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: theme?.text || '#e0e0e0',
      marginBottom: 20,
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderRadius: 12,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    optionIcon: {
      fontSize: 24,
      marginRight: 14,
    },
    optionText: {
      flex: 1,
    },
    optionLabel: {
      color: theme?.text || '#e0e0e0',
      fontSize: 16,
      fontWeight: '600',
    },
    optionDesc: {
      color: theme?.textMuted || '#888',
      fontSize: 13,
      marginTop: 2,
    },
    check: {
      fontSize: 18,
      fontWeight: '700',
    },
  })
}
