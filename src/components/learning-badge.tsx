import { View, Text, StyleSheet } from 'react-native'
import type { ThemeColors } from '../lib/theme'

const STAGE_CONFIG: Record<string, { label: string; desc: string; color: string }> = {
  cold_start: {
    label: '初识',
    desc: '正在了解你的沟通偏好',
    color: '#533483',
  },
  calibration: {
    label: '磨合',
    desc: '逐步优化我的回应方式',
    color: '#b8860b',
  },
  deep_tuning: {
    label: '默契',
    desc: '已建立深度理解',
    color: '#2e8b57',
  },
}

type Props = {
  stage: string
  interactionCount?: number
  theme?: ThemeColors
}

export default function LearningBadge({ stage, interactionCount, theme }: Props) {
  const config = STAGE_CONFIG[stage] || STAGE_CONFIG.cold_start
  const s = makeStyles(theme)

  return (
    <View style={[s.badge, { borderColor: config.color, backgroundColor: theme?.surface || '#16213e' }]}>
      <View style={[s.dot, { backgroundColor: config.color }]} />
      <View style={s.textBlock}>
        <Text style={[s.label, { color: config.color }]}>
          {config.label}
        </Text>
        <Text style={s.desc}>{config.desc}</Text>
        {interactionCount !== undefined && (
          <Text style={s.count}>
            已对话 {interactionCount} 次
          </Text>
        )}
      </View>
    </View>
  )
}

function makeStyles(theme?: ThemeColors) {
  return StyleSheet.create({
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 12,
      borderWidth: 1,
      padding: 12,
      marginBottom: 16,
    },
    dot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      marginRight: 12,
    },
    textBlock: {
      flex: 1,
    },
    label: {
      fontSize: 14,
      fontWeight: '700',
    },
    desc: {
      fontSize: 12,
      color: theme?.textMuted || '#888',
      marginTop: 2,
    },
    count: {
      fontSize: 11,
      color: '#666',
      marginTop: 2,
    },
  })
}
