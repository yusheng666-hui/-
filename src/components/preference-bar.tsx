import { View, Text, StyleSheet } from 'react-native'
import type { ThemeColors } from '../lib/theme'

type Props = {
  dimension: string
  value: string
  confidence: number
  theme?: ThemeColors
}

const DIMENSION_LABELS: Record<string, string> = {
  tone: '语气风格',
  advice_style: '建议方式',
  confrontation_comfort: '直言接受度',
  humor: '幽默程度',
  response_depth: '分析深度',
  emotional_expressiveness: '情感表达',
}

const VALUE_LABELS: Record<string, Record<string, string>> = {
  tone: { gentle: '温和', direct: '直接', warm: '温暖', neutral: '中性' },
  advice_style: { reflective: '反思引导', practical: '实用建议', emotional: '情感共鸣', spiritual: '灵性启发' },
  confrontation_comfort: { always_soothe: '始终安抚', gentle_challenge: '温和挑战', direct_honest: '直接坦诚' },
  humor: { none: '无', light: '轻度', moderate: '适中' },
  response_depth: { surface: '表面', moderate: '适度', deep: '深度' },
  emotional_expressiveness: { restrained: '克制', moderate: '适度', expressive: '丰富' },
}

export default function PreferenceBar({ dimension, value, confidence, theme }: Props) {
  const label = DIMENSION_LABELS[dimension] || dimension
  const valueLabel = VALUE_LABELS[dimension]?.[value] || value
  const barWidth = Math.max(4, confidence * 100)
  const s = makeStyles(theme)
  const accentColor = theme?.accent || '#533483'

  const confidenceLabel =
    confidence >= 0.8 ? '已确定' : confidence >= 0.5 ? '初步' : '探索中'

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.dimLabel}>{label}</Text>
        <Text style={s.valueLabel}>{valueLabel}</Text>
      </View>
      <View style={[s.barBg, { backgroundColor: theme?.border || '#0f3460' }]}>
        <View style={[s.barFill, { width: `${barWidth}%`, backgroundColor: accentColor }]} />
      </View>
      <View style={s.header}>
        <Text style={s.confText}>{Math.round(confidence * 100)}%</Text>
        <Text style={s.statusText}>{confidenceLabel}</Text>
      </View>
    </View>
  )
}

function makeStyles(theme?: ThemeColors) {
  return StyleSheet.create({
    container: {
      marginBottom: 16,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    dimLabel: {
      color: theme?.textSecondary || '#ccc',
      fontSize: 13,
      fontWeight: '600',
    },
    valueLabel: {
      color: theme?.textMuted || '#888',
      fontSize: 13,
    },
    barBg: {
      height: 6,
      borderRadius: 3,
      overflow: 'hidden',
      marginBottom: 2,
    },
    barFill: {
      height: '100%',
      borderRadius: 3,
    },
    confText: {
      color: theme?.textMuted || '#888',
      fontSize: 11,
    },
    statusText: {
      color: '#666',
      fontSize: 11,
    },
  })
}
