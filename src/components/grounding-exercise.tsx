// Grounding 练习组件 — 交互式引导

import { Modal, View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native'
import { useState, useRef, useEffect } from 'react'
import type { ThemeColors } from '../lib/theme'

type Props = {
  visible: boolean
  onClose: () => void
  theme: ThemeColors
}

type Step = {
  instruction: string
  hint?: string
}

const EXERCISE_54321: Step[] = [
  { instruction: '说出 5 样你看到的东?', hint: '?边有什么？?桌、窗户、杯?…' },
  { instruction: '感受 4 样你能摸到的', hint: '衣服的质感、椅子的温度…' },
  { instruction: '听出 3 种声音', hint: '空调声、键盘声、窗外的声音…' },
  { instruction: '闻出 2 种气味', hint: '空气的味道、咖啡的香气…' },
  { instruction: '说出 1 件关于你自己的好事', hint: '?天呼吸了、此刻在照顾自己…' },
]

const BREATHING_STEPS: Step[] = [
  { instruction: '??吸 4 秒', hint: '慢慢吸气，让空气充满肺部' },
  { instruction: '??息 4 秒', hint: '轻轻屏住呼吸' },
  { instruction: '??气 6 秒', hint: '慢慢呼出，比吸气更慢' },
]

type ExerciseType = '54321' | 'breathing'

const EXERCISE_CONFIG: Record<ExerciseType, { title: string; icon: string; steps: Step[] }> = {
  '54321': { title: '5-4-3-2-1 感官法', icon: '👀', steps: EXERCISE_54321 },
  breathing: { title: '深呼吸引导', icon: '🌬️', steps: BREATHING_STEPS },
}

export default function GroundingExercise({ visible, onClose, theme }: Props) {
  const [type, setType] = useState<ExerciseType>('54321')
  const [stepIndex, setStepIndex] = useState(0)
  const [done, setDone] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const fadeAnim = useRef(new Animated.Value(1)).current

  const exercise = EXERCISE_CONFIG[type]
  const isLastStep = stepIndex >= exercise.steps.length - 1

  useEffect(() => {
    if (visible) {
      setStepIndex(0)
      setDone(false)
      setFeedback(null)
    }
  }, [visible])

  useEffect(() => {
    if (type === 'breathing') {
      const timer = setInterval(() => {
        Animated.sequence([
          Animated.timing(fadeAnim, { toValue: 0.3, duration: 400, useNativeDriver: true }),
          Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        ]).start()
      }, 2000)
      return () => clearInterval(timer)
    }
  }, [type, stepIndex])

  const handleNext = () => {
    if (isLastStep) {
      setDone(true)
    } else {
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
        setStepIndex(s => s + 1)
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start()
      })
    }
  }

  const handleFeedback = (val: string) => {
    setFeedback(val)
    setTimeout(onClose, 800)
  }

  const s = makeStyles(theme)
  const step = exercise.steps[stepIndex]

  if (!visible) return null

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={[s.card, { backgroundColor: theme.surface }]}>
          {/* Mode selector */}
          {stepIndex === 0 && !done && (
            <View style={s.modeRow}>
              {(Object.entries(EXERCISE_CONFIG) as [ExerciseType, typeof exercise][]).map(([key, cfg]) => (
                <TouchableOpacity
                  key={key}
                  style={[s.modeBtn, { backgroundColor: type === key ? theme.accent + '22' : theme.surfaceLight, borderColor: type === key ? theme.accent : 'transparent' }]}
                  onPress={() => setType(key)}
                >
                  <Text style={s.modeIcon}>{cfg.icon}</Text>
                  <Text style={[s.modeLabel, { color: theme.text }]}>{cfg.title}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Done screen */}
          {done ? (
            <View style={s.doneContainer}>
              <Text style={s.doneIcon}>🧘</Text>
              <Text style={[s.doneTitle, { color: theme.text }]}>练习完成</Text>
              <Text style={[s.doneDesc, { color: theme.textSecondary }]}>现在感觉怎么样？</Text>
              <View style={s.feedbackRow}>
                {['好一点了', '没变化', '更糟了'].map(fb => (
                  <TouchableOpacity
                    key={fb}
                    style={[s.feedbackBtn, { backgroundColor: theme.surfaceLight, borderColor: feedback === fb ? theme.accent : theme.border }]}
                    onPress={() => handleFeedback(fb)}
                    disabled={!!feedback}
                  >
                    <Text style={{ color: feedback === fb ? theme.accent : theme.textSecondary, fontWeight: '600' }}>{fb}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : (
            <>
              {/* Step counter */}
              <View style={s.stepDots}>
                {exercise.steps.map((_, i) => (
                  <View key={i} style={[s.stepDot, { backgroundColor: i === stepIndex ? theme.accent : theme.border }]} />
                ))}
              </View>

              {/* Instruction */}
              <Animated.View style={{ opacity: fadeAnim }}>
                <Text style={s.stepNumber}>{stepIndex + 1}/{exercise.steps.length}</Text>
                <Text style={[s.instruction, { color: theme.text }]}>{step.instruction}</Text>
                {step.hint && (
                  <Text style={[s.hint, { color: theme.textMuted }]}>{step.hint}</Text>
                )}

                {/* Breathing animation */}
                {type === 'breathing' && (
                  <Animated.View style={[s.breathCircle, { backgroundColor: theme.accent + '44', borderColor: theme.accent, opacity: fadeAnim }]} />
                )}
              </Animated.View>

              <TouchableOpacity
                style={[s.nextBtn, { backgroundColor: theme.accent }]}
                onPress={handleNext}
              >
                <Text style={s.nextText}>{isLastStep ? '完成' : '下一步'}</Text>
              </TouchableOpacity>
            </>
          )}

          {!done && (
            <TouchableOpacity onPress={onClose} style={s.exitBtn}>
              <Text style={{ color: theme.textMuted, fontSize: 14 }}>退出</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  )
}

function makeStyles(theme: ThemeColors) {
  return StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 24 },
    card: { borderRadius: 20, padding: 24, width: '100%', maxWidth: 360, alignItems: 'center' },
    modeRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
    modeBtn: { flex: 1, alignItems: 'center', padding: 14, borderRadius: 14, borderWidth: 2 },
    modeIcon: { fontSize: 28, marginBottom: 6 },
    modeLabel: { fontSize: 13, fontWeight: '600' },
    stepDots: { flexDirection: 'row', gap: 6, marginBottom: 20 },
    stepDot: { width: 8, height: 8, borderRadius: 4 },
    stepNumber: { fontSize: 13, color: theme.textMuted, marginBottom: 8 },
    instruction: { fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: 12, lineHeight: 32 },
    hint: { fontSize: 14, textAlign: 'center', marginBottom: 20, lineHeight: 22 },
    breathCircle: { width: 120, height: 120, borderRadius: 60, borderWidth: 3, alignSelf: 'center', marginVertical: 20 },
    doneContainer: { alignItems: 'center', padding: 20 },
    doneIcon: { fontSize: 48, marginBottom: 12 },
    doneTitle: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
    doneDesc: { fontSize: 15, marginBottom: 20 },
    feedbackRow: { flexDirection: 'row', gap: 10 },
    feedbackBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, borderWidth: 1 },
    nextBtn: { borderRadius: 14, paddingVertical: 14, paddingHorizontal: 48, marginTop: 20 },
    nextText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    exitBtn: { marginTop: 16, padding: 8 },
  })
}