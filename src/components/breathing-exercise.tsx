import { useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  Modal,
} from 'react-native'

type Pattern = '4-7-8' | 'box' | 'simple'

const PATTERNS: Record<Pattern, { inhale: number; hold: number; exhale: number; label: string; desc: string }> = {
  '4-7-8': { inhale: 4, hold: 7, exhale: 8, label: '4-7-8 呼吸法', desc: '缓解焦虑，帮助入睡' },
  'box': { inhale: 4, hold: 4, exhale: 4, label: '盒子呼吸法', desc: '提升专注力' },
  'simple': { inhale: 4, hold: 2, exhale: 6, label: '简单放松', desc: '日常减压' },
}

type Phase = 'inhale' | 'hold' | 'exhale' | 'idle'

export default function BreathingExercise({
  visible,
  onClose,
  theme,
}: {
  visible: boolean
  onClose: () => void
  theme: any
}) {
  const [pattern, setPattern] = useState<Pattern>('4-7-8')
  const [phase, setPhase] = useState<Phase>('idle')
  const [count, setCount] = useState(0)
  const [running, setRunning] = useState(false)
  const [cycles, setCycles] = useState(0)
  const anim = useRef(new Animated.Value(1)).current
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const cfg = PATTERNS[pattern]

  useEffect(() => {
    if (!running) {
      if (timerRef.current) clearInterval(timerRef.current)
      return
    }

    let phaseIdx = 0
    const phases: { name: Phase; duration: number }[] = [
      { name: 'inhale', duration: cfg.inhale },
      { name: 'hold', duration: cfg.hold },
      { name: 'exhale', duration: cfg.exhale },
    ]
    const totalSteps = cfg.inhale + cfg.hold + cfg.exhale
    let step = 0

    setCycles(0)
    setPhase('inhale')
    setCount(cfg.inhale)

    timerRef.current = setInterval(() => {
      step++
      const currentPhase = phases[phaseIdx]

      if (step >= currentPhase.duration) {
        step = 0
        phaseIdx++
        if (phaseIdx >= phases.length) {
          phaseIdx = 0
          setCycles((c) => c + 1)
        }
        const next = phases[phaseIdx]
        setPhase(next.name)
        setCount(next.duration)
      } else {
        setCount((c) => c - 1)
      }
    }, 1000)

    // Breathing animation
    const breatheAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1.4,
          duration: cfg.inhale * 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 1.4,
          duration: cfg.hold * 1000,
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 1,
          duration: cfg.exhale * 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    )
    breatheAnim.start()

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      breatheAnim.stop()
    }
  }, [running, pattern])

  const start = () => setRunning(true)
  const stop = () => {
    setRunning(false)
    setPhase('idle')
    setCount(0)
    setCycles(0)
    anim.setValue(1)
  }

  const phaseLabel: Record<Phase, string> = {
    inhale: '吸气',
    hold: '屏息',
    exhale: '呼气',
    idle: '准备',
  }

  const phaseColor: Record<Phase, string> = {
    inhale: '#63c5da',
    hold: '#f9a825',
    exhale: '#81c784',
    idle: theme.accent,
  }

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: theme.surface }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={{ color: theme.textMuted, fontSize: 20 }}>✕</Text>
          </TouchableOpacity>

          <Text style={[styles.title, { color: theme.text }]}>呼吸练习</Text>

          {/* Pattern selector */}
          {!running && (
            <View style={styles.patternRow}>
              {(Object.keys(PATTERNS) as Pattern[]).map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[
                    styles.patternBtn,
                    {
                      backgroundColor: pattern === p ? theme.accent : theme.surfaceLight,
                    },
                  ]}
                  onPress={() => setPattern(p)}
                >
                  <Text
                    style={{
                      color: pattern === p ? '#fff' : theme.textSecondary,
                      fontSize: 13,
                      fontWeight: '600',
                    }}
                  >
                    {PATTERNS[p].label}
                  </Text>
                  <Text
                    style={{
                      color: pattern === p ? 'rgba(255,255,255,0.8)' : theme.textMuted,
                      fontSize: 11,
                    }}
                  >
                    {PATTERNS[p].desc}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Breathing circle */}
          <View style={styles.circleWrap}>
            <Animated.View
              style={[
                styles.circle,
                {
                  transform: [{ scale: anim }],
                  backgroundColor: running ? phaseColor[phase] + '20' : theme.surfaceLight,
                  borderColor: running ? phaseColor[phase] : theme.border,
                },
              ]}
            />
            <View style={[styles.innerCircle, { backgroundColor: running ? phaseColor[phase] : theme.accent }]}>
              {running ? (
                <>
                  <Text style={styles.countText}>{count > 0 ? count : '•'}</Text>
                  <Text style={styles.phaseText}>{phaseLabel[phase]}</Text>
                  <Text style={styles.cycleText}>{cycles} 轮</Text>
                </>
              ) : (
                <Text style={styles.idleText}>🫁</Text>
              )}
            </View>
          </View>

          {/* Controls */}
          <View style={styles.controlRow}>
            {!running ? (
              <TouchableOpacity
                style={[styles.startBtn, { backgroundColor: theme.accent }]}
                onPress={start}
              >
                <Text style={styles.startText}>开始</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.startBtn, { backgroundColor: theme.danger }]}
                onPress={stop}
              >
                <Text style={styles.startText}>结束</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  card: { width: '90%', borderRadius: 24, padding: 24, alignItems: 'center' },
  closeBtn: { position: 'absolute', top: 16, right: 16, zIndex: 1, padding: 4 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 20 },
  patternRow: { flexDirection: 'row', gap: 8, marginBottom: 24, flexWrap: 'wrap', justifyContent: 'center' },
  patternBtn: { borderRadius: 12, padding: 12, alignItems: 'center', minWidth: 100 },
  circleWrap: { width: 200, height: 200, justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  circle: {
    position: 'absolute', width: 200, height: 200, borderRadius: 100,
    borderWidth: 2,
  },
  innerCircle: { width: 120, height: 120, borderRadius: 60, justifyContent: 'center', alignItems: 'center' },
  countText: { color: '#fff', fontSize: 48, fontWeight: '700' },
  phaseText: { color: 'rgba(255,255,255,0.9)', fontSize: 14, fontWeight: '500' },
  cycleText: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 4 },
  idleText: { fontSize: 48 },
  controlRow: { flexDirection: 'row', gap: 16 },
  startBtn: { borderRadius: 16, paddingHorizontal: 40, paddingVertical: 14 },
  startText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})
