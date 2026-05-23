// 语音消息录制组件 — 按住录制，松手发送

import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useState, useRef } from 'react'
import type { ThemeColors } from '../lib/theme'

type Props = {
  theme: ThemeColors
  onSendAudio: (data: string, mimeType: string) => void
  onClose: () => void
}

export default function VoiceRecorder({ theme, onSendAudio, onClose }: Props) {
  const [recording, setRecording] = useState(false)
  const [pressed, setPressed] = useState(false)
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handlePressIn = () => {
    setPressed(true)
    setRecording(true)
  }

  const handlePressOut = () => {
    setPressed(false)
    setRecording(false)
  }

  const s = makeStyles(theme)

  return (
    <View style={s.container}>
      <TouchableOpacity
        style={[s.recordBtn, recording && s.recordingBtn]}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.7}
      >
        <Text style={s.micIcon}>{recording ? '🔴' : '🎤'}</Text>
        <Text style={[s.tip, { color: theme.textMuted }]}>
          {recording ? '松手发送 · 上滑取消' : '按住录音'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onClose} style={s.cancelBtn}>
        <Text style={{ color: theme.textMuted, fontSize: 14 }}>取消</Text>
      </TouchableOpacity>
    </View>
  )
}

function makeStyles(theme: ThemeColors) {
  return StyleSheet.create({
    container: { alignItems: 'center', paddingVertical: 20 },
    recordBtn: {
      width: 120, height: 120, borderRadius: 60,
      backgroundColor: theme.surfaceLight,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 3, borderColor: theme.border,
    },
    recordingBtn: {
      borderColor: theme.danger,
      transform: [{ scale: 1.1 }],
    },
    micIcon: { fontSize: 40 },
    tip: { fontSize: 13, marginTop: 12 },
    cancelBtn: { marginTop: 20, padding: 8 },
  })
}
