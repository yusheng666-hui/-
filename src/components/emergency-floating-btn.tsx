// 情绪急救浮动按钮 — 所有页面右下角

import { TouchableOpacity, Text, StyleSheet, Platform } from 'react-native'
import { router, useSegments } from 'expo-router'
import type { ThemeColors } from '../lib/theme'

type Props = {
  visible: boolean
  theme: ThemeColors
}

export default function EmergencyFloatingBtn({ visible, theme }: Props) {
  const segments = useSegments()

  // 在聊天页或设置页隐藏，避免遮挡操作
  const isChatPage = segments[0] === 'chat'
  const isSettingsPage = segments[0] === 'settings'

  if (!visible || isChatPage || isSettingsPage) return null

  return (
    <TouchableOpacity
      style={[s.button, { backgroundColor: theme.accent + 'dd' }]}
      onPress={() => router.push('/chat/new?mode=emergency')}
      activeOpacity={0.7}
    >
      <Text style={s.icon}>🫂</Text>
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  button: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
    elevation: 6,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
      },
      android: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
    }),
  },
  icon: {
    fontSize: 26,
  },
})
