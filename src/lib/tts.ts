// TTS 引擎封装 — 统一 expo-speech / OpenAI TTS / Web Speech Synthesis 三后端
// 对外暴露 speak / stop / pause / resume / isSpeaking 接口

import * as Speech from 'expo-speech'
import { getApiKey, KEYS } from './storage'

export type TTSProvider = 'expo-speech' | 'openai-tts' | 'web-speech' | 'voice-cloning'

export type TTSConfig = {
  provider: TTSProvider
  voice: string
  speed: number
  pitch: number
  volume: number
  serverUrl?: string
}

export type TTSEvent = {
  type: 'start' | 'word' | 'end' | 'pause' | 'resume' | 'stop' | 'error'
  charIndex?: number
  charLength?: number
  message?: string
}

export type TTSOptions = {
  onEvent?: (event: TTSEvent) => void
  signal?: AbortSignal
}

let currentStop: (() => void) | null = null
let _isSpeaking = false
let _isPaused = false
let _currentProvider: TTSProvider = 'expo-speech'
let _openAIAudio: HTMLAudioElement | null = null

export function isSpeaking(): boolean {
  return _isSpeaking
}

export function isPaused(): boolean {
  return _isPaused
}

// ===== expo-speech 后端（默认，免费离线） =====
function speakExpoSpeech(text: string, config: TTSConfig, options: TTSOptions): Promise<void> {
  return new Promise((resolve) => {
    _isSpeaking = true
    _isPaused = false
    _currentProvider = 'expo-speech'
    options.onEvent?.({ type: 'start' })

    const voice = config.voice || undefined
    Speech.speak(text, {
      language: 'zh-CN',
      rate: Math.max(0.5, Math.min(1.5, config.speed)),
      pitch: Math.max(0.5, Math.min(1.5, config.pitch)),
      volume: Math.max(0, Math.min(1, config.volume)),
      voice,
      onStart: () => options.onEvent?.({ type: 'start' }),
      onDone: () => {
        _isSpeaking = false
        currentStop = null
        options.onEvent?.({ type: 'end' })
        resolve()
      },
      onError: (err: any) => {
        _isSpeaking = false
        currentStop = null
        options.onEvent?.({ type: 'error', message: err?.message || String(err) })
        resolve()
      },
      onBoundary: (info: any) => {
        options.onEvent?.({ type: 'word', charIndex: info.charIndex, charLength: info.charLength })
      },
    })

    currentStop = () => {
      Speech.stop()
      _isSpeaking = false
      options.onEvent?.({ type: 'stop' })
      resolve()
    }

    if (options.signal) {
      options.signal.addEventListener('abort', () => {
        Speech.stop()
        _isSpeaking = false
        resolve()
      }, { once: true })
    }
  })
}

// ===== OpenAI TTS 后端（高自然度，需 API Key） =====
async function speakOpenAITTS(text: string, config: TTSConfig, options: TTSOptions): Promise<void> {
  const key = await getApiKey(KEYS.TTS_API_KEY) || await getApiKey(KEYS.ANTHROPIC_API_KEY)
  if (!key) {
    options.onEvent?.({ type: 'error', message: '未配置 TTS API Key' })
    return
  }

  _isSpeaking = true
  _isPaused = false
  _currentProvider = 'openai-tts'
  options.onEvent?.({ type: 'start' })

  try {
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1-hd',
        voice: config.voice || 'nova',
        input: text,
        speed: Math.max(0.25, Math.min(4.0, config.speed)),
        response_format: 'mp3',
      }),
      signal: options.signal,
    })

    if (!response.ok) {
      throw new Error(`OpenAI TTS error: ${response.status}`)
    }

    const audioBlob = await response.blob()
    const url = URL.createObjectURL(audioBlob)
    const audio = new Audio(url)
    _openAIAudio = audio

    audio.onended = () => {
      _isSpeaking = false
      _isPaused = false
      _openAIAudio = null
      currentStop = null
      URL.revokeObjectURL(url)
      options.onEvent?.({ type: 'end' })
    }

    audio.onerror = () => {
      _isSpeaking = false
      _isPaused = false
      _openAIAudio = null
      currentStop = null
      URL.revokeObjectURL(url)
      options.onEvent?.({ type: 'error', message: '音频播放失败' })
    }

    audio.play()

    currentStop = () => {
      audio.pause()
      audio.currentTime = 0
      _isSpeaking = false
      _isPaused = false
      _openAIAudio = null
      URL.revokeObjectURL(url)
      options.onEvent?.({ type: 'stop' })
    }

    if (options.signal) {
      options.signal.addEventListener('abort', () => {
        audio.pause()
        _isSpeaking = false
        URL.revokeObjectURL(url)
      }, { once: true })
    }
  } catch (err) {
    _isSpeaking = false
    options.onEvent?.({ type: 'error', message: err instanceof Error ? err.message : 'TTS 调用失败' })
  }
}

// ===== Web Speech Synthesis API 后端（Web fallback） =====
function speakWebSpeech(text: string, config: TTSConfig, options: TTSOptions): Promise<void> {
  return new Promise((resolve) => {
    _currentProvider = 'web-speech'
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'zh-CN'
    utterance.rate = Math.max(0.1, Math.min(10, config.speed))
    utterance.pitch = Math.max(0, Math.min(2, config.pitch))
    utterance.volume = Math.max(0, Math.min(1, config.volume))

    _isSpeaking = true
    _isPaused = false
    options.onEvent?.({ type: 'start' })

    utterance.onstart = () => options.onEvent?.({ type: 'start' })
    utterance.onend = () => {
      _isSpeaking = false
      currentStop = null
      options.onEvent?.({ type: 'end' })
      resolve()
    }
    utterance.onerror = (e) => {
      _isSpeaking = false
      currentStop = null
      options.onEvent?.({ type: 'error', message: e.error })
      resolve()
    }
    utterance.onboundary = (e) => {
      if (e.name === 'word') {
        options.onEvent?.({ type: 'word', charIndex: e.charIndex, charLength: e.charLength })
      }
    }

    window.speechSynthesis.speak(utterance)

    currentStop = () => {
      window.speechSynthesis.cancel()
      _isSpeaking = false
      options.onEvent?.({ type: 'stop' })
      resolve()
    }

    if (options.signal) {
      options.signal.addEventListener('abort', () => {
        window.speechSynthesis.cancel()
        _isSpeaking = false
        resolve()
      }, { once: true })
    }
  })
}

// ===== Voice Clone TTS (HF Spaces OpenVoice v2) =====
async function speakVoiceClone(text: string, config: TTSConfig, options: TTSOptions): Promise<void> {
  _isSpeaking = true
  _isPaused = false
  _currentProvider = 'voice-cloning'
  options.onEvent?.({ type: 'start' })

  const controller = new AbortController()
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  try {
    const serverUrl = config.serverUrl || ''
    const cloneVoiceId = config.voice || ''

    if (!serverUrl) {
      throw new Error('未配置语音克隆服务器地址')
    }

    timeoutId = setTimeout(() => controller.abort(), 60000)
    if (options.signal) {
      options.signal.addEventListener('abort', () => { clearTimeout(timeoutId); controller.abort() }, { once: true })
    }

    // Call Gradio text_to_speech API (try multiple API paths)
    const baseUrl = serverUrl.replace(/\/$/, '')
    // Gradio 4.x uses /gradio_api/api/predict/{api_name} when api_name is set
    // Older versions use /api/predict
    const apiPaths = [
      '/gradio_api/api/predict/text_to_speech',
      '/api/predict/text_to_speech',
      '/gradio_api/api/predict',
      '/api/predict',
    ]

    let response = null
    let result = null

    for (const apiPath of apiPaths) {
      try {
        const res = await fetch(`${baseUrl}${apiPath}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            data: [text, cloneVoiceId || '', config.speed],
          }),
          signal: controller.signal,
        })
        if (res.ok) {
          response = res
          result = await res.json()
          break
        }
      } catch {}
    }

    if (!response || !result) {
      throw new Error('无法连接到语音克隆服务器，请检查服务器地址是否正确')
    }

    const audioFile = result?.data?.[0]
    const statusMsg = result?.data?.[1] || ''

    if (!audioFile) {
      throw new Error(statusMsg || '服务器未返回音频')
    }

    // Gradio returns file path - extract it
    let filePath
    if (typeof audioFile === 'object' && audioFile.path) {
      filePath = audioFile.path
    } else if (typeof audioFile === 'object' && audioFile.name) {
      filePath = audioFile.name
    } else if (typeof audioFile === 'string') {
      filePath = audioFile
    } else {
      throw new Error('服务器返回了无法识别的音频格式')
    }

    // Try multiple file URL formats (Gradio version dependent)
    const urlVariants = [
      `${baseUrl}/file=${encodeURIComponent(filePath)}`,
      `${baseUrl}/file/${encodeURIComponent(filePath)}`,
      `${baseUrl}/gradio_api/file=${encodeURIComponent(filePath)}`,
    ]
    let audioUrl = ''
    let audioResponse = null
    for (const urlVariant of urlVariants) {
      try {
        const res = await fetch(urlVariant, { signal: controller.signal })
        if (res.ok) {
          audioUrl = urlVariant
          audioResponse = res
          break
        }
      } catch {}
    }

    if (!audioResponse) {
      throw new Error('获取音频文件失败')
    }

    const audioBlob = await audioResponse.blob()
    const url = URL.createObjectURL(audioBlob)
    const audio = new Audio(url)
    _openAIAudio = audio

    return new Promise((resolve) => {
      audio.onended = () => {
        clearTimeout(timeoutId)
        _isSpeaking = false
        _isPaused = false
        _openAIAudio = null
        currentStop = null
        URL.revokeObjectURL(url)
        options.onEvent?.({ type: 'end' })
        resolve()
      }

      audio.onerror = () => {
        clearTimeout(timeoutId)
        _isSpeaking = false
        _isPaused = false
        _openAIAudio = null
        currentStop = null
        URL.revokeObjectURL(url)
        options.onEvent?.({ type: 'error', message: '音频播放失败' })
        resolve()
      }

      audio.play().catch((err) => {
        clearTimeout(timeoutId)
        _isSpeaking = false
        _openAIAudio = null
        URL.revokeObjectURL(url)
        options.onEvent?.({ type: 'error', message: err.message })
        resolve()
      })

      currentStop = () => {
        clearTimeout(timeoutId)
        audio.pause()
        audio.currentTime = 0
        _isSpeaking = false
        _isPaused = false
        _openAIAudio = null
        URL.revokeObjectURL(url)
        options.onEvent?.({ type: 'stop' })
        resolve()
      }
    })
  } catch (err) {
    clearTimeout(timeoutId)
    _isSpeaking = false
    options.onEvent?.({
      type: 'error',
      message: err instanceof Error ? err.message : '语音克隆调用失败',
    })
  }
}

// ===== 统一接口 =====
export async function speak(
  text: string,
  config: TTSConfig,
  options: TTSOptions = {},
): Promise<void> {
  // 停止当前播放
  if (_isSpeaking) {
    stop()
    await new Promise(r => setTimeout(r, 100))
  }

  switch (config.provider) {
    case 'openai-tts':
      return speakOpenAITTS(text, config, options)
    case 'web-speech':
      return speakWebSpeech(text, config, options)
    case 'voice-cloning':
      return speakVoiceClone(text, config, options)
    case 'expo-speech':
    default:
      return speakExpoSpeech(text, config, options)
  }
}

export function stop(): void {
  if (currentStop) {
    currentStop()
    currentStop = null
  }
}

export function pause(): void {
  if (!_isSpeaking || _isPaused) return
  try {
    if (_currentProvider === 'expo-speech') {
      Speech.pause()
    } else if (_currentProvider === 'web-speech') {
      window.speechSynthesis?.pause()
    } else if (_currentProvider === 'openai-tts' && _openAIAudio) {
      _openAIAudio.pause()
    } else if (_currentProvider === 'voice-cloning' && _openAIAudio) {
      _openAIAudio.pause()
    }
    _isPaused = true
  } catch {}
}

export function resume(): void {
  if (!_isSpeaking || !_isPaused) return
  try {
    if (_currentProvider === 'expo-speech') {
      Speech.resume()
    } else if (_currentProvider === 'web-speech') {
      window.speechSynthesis?.resume()
    } else if (_currentProvider === 'openai-tts' && _openAIAudio) {
      _openAIAudio.play()
    } else if (_currentProvider === 'voice-cloning' && _openAIAudio) {
      _openAIAudio.play()
    }
    _isPaused = false
  } catch {}
}
