// 新手引导组件 — 三段式可滑动引导

import { Modal, View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions } from 'react-native'
import { useState, useRef } from 'react'
import type { ThemeColors } from '../lib/theme'

type Props = {
  visible: boolean
  onComplete: () => void
  theme: ThemeColors
}

const STEPS = [
  {
    icon: '🧠',
    title: '我先思考，再回你',
    desc: '每次回复前，AI 会先分析你的情绪状态，\n确保回应更贴心。\n\n你可以看到完整的思考过程。',
  },
  {
    icon: '📊',
    title: '你越用，我越懂你',
    desc: 'AI 会学习你的沟通偏好——\n语气、幽默感、分析深度……\n\n聊得越多，越合拍。',
  },
  {
    icon: '📝',
    title: '想安静的时候',
    desc: '不想说话时切换到「日志模式」，\n纯记录不对话。\n\n你的情绪，由你掌控。',
  },
]

const { width } = Dimensions.get('window')

export default function OnboardingGuide({ visible, onComplete, theme }: Props) {
  const [stepIndex, setStepIndex] = useState(0)
  const fadeAnim = useRef(new Animated.Value(1)).current
  const slideAnim = useRef(new Animated.Value(0)).current

  const isLastStep = stepIndex >= STEPS.length - 1

  const handleNext = () => {
    if (isLastStep) {
      onComplete()
      return
    }
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: -width * 0.3,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setStepIndex(s => s + 1)
      slideAnim.setValue(width * 0.3)
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start()
    })
  }

  const handleSkip = () => {
    onComplete()
  }

  const current = STEPS[stepIndex]
  const s = makeStyles(theme)

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleSkip}>
      <View style={s.overlay}>
        <View style={[s.card, { backgroundColor: theme.background }]}>
          {/* 步骤指示点 */}
          <View style={s.dotRow}>
            {STEPS.map((_, i) => (
              <View
                key={i}
                style={[
                  s.dot,
                  {
                    backgroundColor:
                      i === stepIndex ? theme.accent : theme.border,
                    width: i === stepIndex ? 24 : 8,
                  },
                ]}
              />
            ))}
          </View>

          {/* 内容 */}
          <Animated.View
            style={[
              s.contentContainer,
              {
                opacity: fadeAnim,
                transform: [{ translateX: slideAnim }],
              },
            ]}
          >
            <Text style={s.icon}>{current.icon}</Text>
            <Text style={[s.title, { color: theme.text }]}>{current.title}</Text>
            <Text style={[s.desc, { color: theme.textSecondary }]}>
              {current.desc}
            </Text>
          </Animated.View>

          {/* 按钮 */}
          <View style={s.buttonRow}>
            <TouchableOpacity onPress={handleSkip} style={s.skipBtn}>
              <Text style={{ color: theme.textMuted, fontSize: 15 }}>
                跳过
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.nextBtn, { backgroundColor: theme.accent }]}
              onPress={handleNext}
            >
              <Text style={s.nextBtnText}>
                {isLastStep ? '开始使用' : '下一步'}
              </Text>
            </TouchableOpacity>
          </View>
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
      backgroundColor: 'rgba(0,0,0,0.6)',
      padding: 24,
    },
    card: {
      borderRadius: 24,
      padding: 40,
      width: '100%',
      maxWidth: 380,
      alignItems: 'center',
    },
    dotRow: {
      flexDirection: 'row',
      gap: 6,
      marginBottom: 40,
    },
    dot: {
      height: 8,
      borderRadius: 4,
    },
    contentContainer: {
      alignItems: 'center',
      width: '100%',
    },
    icon: {
      fontSize: 64,
      marginBottom: 24,
    },
    title: {
      fontSize: 24,
      fontWeight: '700',
      marginBottom: 16,
      textAlign: 'center',
    },
    desc: {
      fontSize: 15,
      lineHeight: 24,
      textAlign: 'center',
      marginBottom: 32,
    },
    buttonRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      width: '100%',
      gap: 16,
    },
    skipBtn: {
      paddingVertical: 14,
      paddingHorizontal: 16,
    },
    nextBtn: {
      borderRadius: 14,
      paddingVertical: 14,
      paddingHorizontal: 36,
    },
    nextBtnText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
  })
}
