// 语音输入服务 — 统一 Web Speech API (web) + @react-native-voice/voice (native)

import { Platform } from 'react-native'

let VoiceModule: any = null
try {
  VoiceModule = require('@react-native-voice/voice').Voice
} catch {}

export type VoiceInputEvent = {
  type: 'result' | 'error' | 'end' | 'start'
  value?: string
  message?: string
}

type VoiceInputCallback = (event: VoiceInputEvent) => void

type VoiceRecognizer = {
  start: (lang: string) => Promise<void>
  stop: () => Promise<void>
  destroy: () => Promise<void>
  isAvailable: () => boolean
}

// 原生端：@react-native-voice/voice
function createNativeRecognizer(cb: VoiceInputCallback): VoiceRecognizer {
  if (!VoiceModule) {
    return { start: async () => {}, stop: async () => {}, destroy: async () => {}, isAvailable: () => false }
  }

  VoiceModule.onSpeechStart = () => cb({ type: 'start' })
  VoiceModule.onSpeechEnd = () => cb({ type: 'end' })
  VoiceModule.onSpeechResults = (e: any) => {
    if (e.value?.[0]) cb({ type: 'result', value: e.value[0] })
  }
  VoiceModule.onSpeechError = (e: any) => cb({ type: 'error', message: e.error?.message || '语音识别错误' })

  return {
    start: (lang: string) => VoiceModule.start(lang),
    stop: () => VoiceModule.stop(),
    destroy: () => VoiceModule.destroy(),
    isAvailable: () => true,
  }
}

// Web 端：Web Speech API
function createWebRecognizer(cb: VoiceInputCallback): VoiceRecognizer {
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  let recognition: any = null

  const isAvailable = () => !!SpeechRecognition

  const start = async (lang: string) => {
    if (!SpeechRecognition) {
      cb({ type: 'error', message: '当前浏览器不支持语音输入' })
      return
    }
    recognition = new SpeechRecognition()
    recognition.lang = lang
    recognition.continuous = false
    recognition.interimResults = false

    recognition.onstart = () => cb({ type: 'start' })
    recognition.onend = () => cb({ type: 'end' })
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript
      cb({ type: 'result', value: transcript })
    }
    recognition.onerror = (e: any) => cb({ type: 'error', message: e.error })

    recognition.start()
  }

  const stop = async () => {
    if (recognition) {
      recognition.stop()
      recognition = null
    }
  }

  const destroy = async () => {
    if (recognition) {
      recognition.abort()
      recognition = null
    }
  }

  return { start, stop, destroy, isAvailable }
}

export function createVoiceRecognizer(cb: VoiceInputCallback): VoiceRecognizer {
  if (Platform.OS === 'web') {
    return createWebRecognizer(cb)
  }
  return createNativeRecognizer(cb)
}
