import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useState } from 'react'
import type { ThemeColors } from '../lib/theme'

type Props = {
  role: 'user' | 'assistant' | 'thought'
  content: string
  theme?: ThemeColors
  showThinking?: boolean  // 是否显示思考过程（false 则完全隐藏）
  isPlaying?: boolean
  isPaused?: boolean
  onPlay?: () => void
  onStop?: () => void
  onPause?: () => void
  onResume?: () => void
  playbackSpeed?: number
}

export default function ChatBubble({ role, content, theme, showThinking = true, isPlaying, isPaused, onPlay, onStop, onPause, onResume, playbackSpeed }: Props) {
  const [expanded, setExpanded] = useState(false)
  const s = makeStyles(theme)

  // 思考气泡：如果 showThinking 为 false 则完全隐藏
  if (role === 'thought' && !showThinking) return null

  return (
    <View
      style={[
        s.bubble,
        role === 'user'
          ? s.userBubble
          : role === 'thought'
            ? s.thoughtBubble
            : s.assistantBubble,
      ]}
    >
      {/* 思考气泡：折叠/展开切换 */}
      {role === 'thought' ? (
        <TouchableOpacity onPress={() => setExpanded(!expanded)} style={s.thoughtTouchable}>
          <Text style={s.thoughtPrefix}>{expanded ? '🧠' : '🧠'}</Text>
          <View style={s.thoughtContent}>
            {expanded ? (
              <Text style={s.thoughtText} selectable>
                {content}
              </Text>
            ) : (
              <Text style={s.thoughtCollapsed}>
                思考过程
              </Text>
            )}
          </View>
        </TouchableOpacity>
      ) : (
        <Text
          style={role === 'user' ? s.userText : s.assistantText}
          selectable
        >
          {content}
        </Text>
      )}

      {/* 语音播放按钮 — 仅 AI 回复 */}
      {role === 'assistant' && (
        <View style={s.voiceRow}>
          {!isPlaying ? (
            <TouchableOpacity
              style={[s.playBtn, { backgroundColor: theme?.surfaceLight || '#333' }]}
              onPress={onPlay}
            >
              <Text style={s.playBtnText}>🔊</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                style={[s.playBtn, { backgroundColor: theme?.surfaceLight || '#333' }]}
                onPress={isPaused ? onResume : onPause}
              >
                <Text style={s.playBtnText}>{isPaused ? '▶' : '⏸'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.playBtn, { backgroundColor: theme?.surfaceLight || '#333' }]}
                onPress={onStop}
              >
                <Text style={s.playBtnText}>⏹</Text>
              </TouchableOpacity>
            </>
          )}
          {playbackSpeed && playbackSpeed !== 1.0 && (
            <Text style={s.speedLabel}>{playbackSpeed}x</Text>
          )}
        </View>
      )}
    </View>
  )
}

export function ModeBadge({ mode, theme }: { mode: string; theme?: ThemeColors }) {
  const s = makeStyles(theme)
  const config: Record<string, { label: string; style: object }> = {
    emergency: { label: '🫂 急救', style: { backgroundColor: theme?.danger || '#8b0000' } },
    low_power: { label: '🔋 低电量', style: { backgroundColor: theme?.warning || '#b8860b' } },
    chat: { label: '', style: {} },
  }
  const c = config[mode]
  if (!c || !c.label) return null
  return (
    <View style={[s.modeBadge, c.style]}>
      <Text style={s.modeText}>{c.label}</Text>
    </View>
  )
}

function makeStyles(theme?: ThemeColors) {
  return StyleSheet.create({
    bubble: {
      maxWidth: '82%',
      padding: 14,
      borderRadius: 18,
      marginBottom: 14,
    },
    userBubble: {
      backgroundColor: theme?.accent || '#533483',
      alignSelf: 'flex-end',
      borderBottomRightRadius: 4,
    },
    thoughtBubble: {
      backgroundColor: theme?.surfaceLight || '#16213e',
      alignSelf: 'flex-start',
      borderBottomLeftRadius: 4,
      padding: 0,
    },
    assistantBubble: {
      backgroundColor: theme?.border || '#0f3460',
      alignSelf: 'flex-start',
      borderBottomLeftRadius: 4,
    },
    thoughtTouchable: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
    },
    thoughtContent: {
      flex: 1,
    },
    thoughtPrefix: {
      color: theme?.textMuted || '#888',
      fontSize: 14,
      marginRight: 8,
    },
    thoughtText: {
      color: theme?.textMuted || '#888',
      fontSize: 14,
      fontStyle: 'italic',
    },
    thoughtCollapsed: {
      color: theme?.textMuted || '#888',
      fontSize: 12,
      opacity: 0.6,
    },
    userText: { color: '#fff', fontSize: 16, lineHeight: 24 },
    assistantText: { color: theme?.text || '#e0e0e0', fontSize: 16, lineHeight: 24 },
    voiceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 8,
      paddingTop: 6,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme?.textMuted || '#666',
    },
    playBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    playBtnText: {
      fontSize: 12,
    },
    speedLabel: {
      color: theme?.textMuted || '#888',
      fontSize: 10,
      marginLeft: 6,
    },
    modeBadge: {
      alignSelf: 'center',
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12,
      marginBottom: 8,
    },
    modeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  })
}