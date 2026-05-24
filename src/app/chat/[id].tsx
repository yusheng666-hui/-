import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  Keyboard,
  Share,
} from 'react-native'
import { useState, useRef, useCallback, useEffect } from 'react'
import { Stack, useLocalSearchParams, router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import { streamChat } from '../../lib/chat'
import * as db from '../../lib/db'
import { speak as ttsSpeak, stop as ttsStop, pause as ttsPause, resume as ttsResume, isSpeaking as ttsIsSpeaking } from '../../lib/tts'
import { preprocessForTTS, stripMarkers } from '../../lib/tts-processor'
import { getEffectiveVoiceParams, applyVoiceSignal, type EmotionKey } from '../../lib/voice-profile'
import { createVoiceRecognizer } from '../../lib/voice-input'
import { useTheme } from '../../lib/theme-context'
import type { ThemeColors } from '../../lib/theme'
import ModeSelector from '../../components/mode-selector'
import ChatBubble, { ModeBadge } from '../../components/chat-bubble'
import MoodPicker from '../../components/mood-picker'
import GroundingExercise from '../../components/grounding-exercise'

type Bubble = {
  id: string
  role: 'user' | 'assistant' | 'thought'
  content: string
}

type SuggestedAction = {
  id: string
  description: string
  status: 'suggested' | 'done' | 'skipped'
}

const ALL_PROMPTS = [
  '今天有什么小事让你烦了一下？',
  '刚才刷到一条让你想吐槽的？',
  '最近单曲循环哪首歌？',
  '给明天的自己写句话',
  '如果明天不用上班/上课，你最想做什么？',
  '最近有没有一件事让你特别有成就感？',
  '你最近一次被感动到是什么时候？',
  '有什么你想说但不知道跟谁说的话？',
  '最近熬夜了吗？为什么睡不着？',
  '刷到一条让你笑出声的评论了吗？',
]

export default function ChatScreen() {
  const insets = useSafeAreaInsets()
  const params = useLocalSearchParams<{ id?: string; mode?: string }>()
  const [input, setInput] = useState('')
  const [bubbles, setBubbles] = useState<Bubble[]>([])
  const [sending, setSending] = useState(false)
  const [convId, setConvId] = useState<string | undefined>(
    params.id && params.id !== 'new' ? params.id : undefined,
  )
  const { theme } = useTheme()
  const [mode, setMode] = useState<'chat' | 'low_power' | 'emergency' | 'journal'>(
    (params.mode as 'chat' | 'low_power' | 'emergency' | 'journal') || 'chat'
  )
  const [listening, setListening] = useState(false)
  const [selectedImage, setSelectedImage] = useState<{ data: string; media_type: string } | null>(null)
  const [suggestedActions, setSuggestedActions] = useState<SuggestedAction[]>([])
  const [silentHint, setSilentHint] = useState(false)
  const [lastActivityTime, setLastActivityTime] = useState<number>(Date.now())
  const [playingBubbleId, setPlayingBubbleId] = useState<string | null>(null)
  const [pausedBubbleId, setPausedBubbleId] = useState<string | null>(null)
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0)
  const [showThinking, setShowThinking] = useState(true)
  const [showMoodPicker, setShowMoodPicker] = useState(false)
  const [moodSavedHint, setMoodSavedHint] = useState(false)
  const [showGrounding, setShowGrounding] = useState(false)
  const [ruminationHint, setRuminationHint] = useState<{ visible: boolean; pattern: string }>({ visible: false, pattern: '' })
  const [recallBanner, setRecallBanner] = useState<{ visible: boolean; count: number; summary: string } | null>(null)
  const [currentRound, setCurrentRound] = useState(0)
  const [quickReplies, setQuickReplies] = useState<string[]>([])
  const flatListRef = useRef<FlatList>(null)
  const idCounterRef = useRef(0)
  const recognitionRef = useRef<any>(null)
  const silentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const nextId = () => (++idCounterRef.current).toString()

  useEffect(() => {
    if (!convId) return
    ;(async () => {
      const msgs = await db.getMessages(convId)
      if (msgs.length > 0) {
        idCounterRef.current = msgs.length
        setBubbles(msgs.map(m => ({
          id: m.id,
          role: m.role as Bubble['role'],
          content: m.content,
        })))
        setLastActivityTime(new Date(msgs[msgs.length - 1].created_at).getTime())
      }

      const logs = await db.getConversationActionLogs(convId)
      if (logs.length > 0) {
        setSuggestedActions(logs.map(l => ({
          id: l.id,
          description: l.action_description,
          status: l.status,
        })))
      }

      const convs = await db.getConversations()
      const conv = convs.find(c => c.id === convId)
      if (conv) setCurrentRound(conv.current_round)
    })()
  }, [convId])

  useEffect(() => {
    return () => { ttsStop() }
  }, [])

  useEffect(() => {
    ;(async () => {
      const p = await db.getProfile()
      setShowThinking(p.show_thinking !== false)
    })()
  }, [])


  const showSilentHintFn = useCallback(() => {
    if (silentTimerRef.current) clearTimeout(silentTimerRef.current)
    silentTimerRef.current = setTimeout(() => {
      setSilentHint(true)
      setTimeout(() => setSilentHint(false), 5000)
    }, 8000)
  }, [])

  const handleVoice = useCallback(() => {
    if (listening && recognitionRef.current) {
      recognitionRef.current.stop()
      setListening(false)
      return
    }

    const recognizer = createVoiceRecognizer((event) => {
      switch (event.type) {
        case 'result':
          setInput(prev => prev + (event.value || ''))
          setListening(false)
          break
        case 'error':
          setBubbles(prev => [...prev, { id: nextId(), role: 'assistant', content: '⚠️ ' + (event.message || '语音识别失败') }])
          setListening(false)
          break
        case 'end':
          setListening(false)
          break
        case 'start':
          break
      }
    })

    if (!recognizer.isAvailable()) {
      setBubbles(prev => [...prev, { id: nextId(), role: 'assistant', content: '⚠️ 当前设备不支持语音输入' }])
      return
    }

    recognitionRef.current = recognizer
    recognizer.start('zh-CN')
    setListening(true)
  }, [listening])

  const handlePickImage = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      setBubbles(prev => [...prev, { id: nextId(), role: 'assistant', content: '⚠️ 需要相册权限才能选择图片' }])
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      base64: true,
      quality: 0.7,
    })

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0]
      const media_type = asset.mimeType || 'image/jpeg'
      if (asset.base64) {
        setSelectedImage({ data: asset.base64, media_type })
      }
    }
  }, [])

  const handleActionDone = useCallback(async (actionId: string) => {
    await db.updateActionLog(actionId, { status: 'done' })
    setSuggestedActions(prev => prev.map(a =>
      a.id === actionId ? { ...a, status: 'done' } : a
    ))
  }, [])

  const handleActionSkip = useCallback(async (actionId: string) => {
    await db.updateActionLog(actionId, { status: 'skipped' })
    setSuggestedActions(prev => prev.map(a =>
      a.id === actionId ? { ...a, status: 'skipped' } : a
    ))
  }, [])

  const handlePlayVoice = useCallback(async (bubbleId: string, text: string) => {
    try {
      const voiceProfile = await db.getVoiceProfile()
      if (!voiceProfile.enabled) return

      setPlayingBubbleId(bubbleId)
      setPausedBubbleId(null)

      const processed = preprocessForTTS(text)
      const cleanText = stripMarkers(processed)
      const { speed, pitch, volume } = getEffectiveVoiceParams(voiceProfile)

      await ttsSpeak(cleanText, {
        provider: voiceProfile.provider,
        voice: voiceProfile.voice_id || '',
        serverUrl: voiceProfile.voice_clone_server_url || undefined,
        speed: speed * playbackSpeed,
        pitch,
        volume,
      }, {
        onEvent: (evt) => {
          if (evt.type === 'end' || evt.type === 'stop' || evt.type === 'error') {
            setPlayingBubbleId(null)
            setPausedBubbleId(null)
            if (evt.type === 'end') {
              const updated = applyVoiceSignal(voiceProfile, { type: 'play_full' })
              db.saveVoiceProfile(updated)
            }
            if (evt.type === 'stop') {
              const updated = applyVoiceSignal(voiceProfile, { type: 'stop_playback' })
              db.saveVoiceProfile(updated)
            }
          }
        },
      })
    } catch {
      setPlayingBubbleId(null)
    }
  }, [playbackSpeed])

  const handleStopVoice = useCallback(() => {
    ttsStop()
    setPlayingBubbleId(null)
    setPausedBubbleId(null)
  }, [])

  const handlePauseVoice = useCallback(() => {
    ttsPause()
    setPausedBubbleId(playingBubbleId)
  }, [playingBubbleId])

  const handleResumeVoice = useCallback(() => {
    ttsResume()
    setPausedBubbleId(null)
  }, [])

  const handleSpeedChange = useCallback(async (speed: number) => {
    setPlaybackSpeed(speed)
    const voiceProfile = await db.getVoiceProfile()
    const updated = applyVoiceSignal(voiceProfile, { type: 'manual_adjust', dimension: 'speed', value: speed })
    await db.saveVoiceProfile(updated)
  }, [])

  const getRandomPrompts = (count: number) => {
    const shuffled = [...ALL_PROMPTS].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, count)
  }

  const handleSend = useCallback(async (overrideText?: string) => {
    const text = (overrideText || input).trim()
    if (!text || sending) return

    const userBubble: Bubble = { id: nextId(), role: 'user', content: text }
    setBubbles((prev) => [...prev, userBubble])
    setInput('')
    setSelectedImage(null)
    setSending(true)
    setSilentHint(false)
    setQuickReplies([])
    if (silentTimerRef.current) clearTimeout(silentTimerRef.current)

    try {
      let assistantBubbleId = nextId()
      let assistantContent = ''
      let thoughtBubbleId: string | null = null
      let lastActionSuggestion: SuggestedAction | null = null

      const images = selectedImage ? [selectedImage] : undefined

      for await (const event of streamChat({
        message: text,
        conversation_id: convId,
        mode,
        personality: undefined,
        images,
      })) {
        switch (event.type) {
          case 'thought':
            if (thoughtBubbleId) {
              setBubbles((prev) => {
                const existing = prev.find((b) => b.id === thoughtBubbleId)
                if (existing) {
                  return prev.map((b) =>
                    b.id === thoughtBubbleId ? { ...b, content: b.content + event.content } : b,
                  )
                }
                return prev
              })
            } else {
              thoughtBubbleId = nextId()
              setBubbles((prev) => [...prev, { id: thoughtBubbleId!, role: 'thought', content: event.content }])
            }
            break

          case 'text':
            assistantContent += event.content
            setBubbles((prev) => {
              const existing = prev.find((b) => b.id === assistantBubbleId)
              if (existing) {
                return prev.map((b) =>
                  b.id === assistantBubbleId ? { ...b, content: assistantContent } : b,
                )
              }
              return [...prev, { id: assistantBubbleId, role: 'assistant' as const, content: assistantContent }]
            })
            break

          case 'action_suggested':
            try {
              const actionData = JSON.parse(event.content)
              lastActionSuggestion = { id: actionData.id, description: actionData.action_description, status: 'suggested' }
              setSuggestedActions(prev => [...prev, lastActionSuggestion!])
            } catch {}
            break

          case 'structured_output':
            try {
              const outputData = JSON.parse(event.content)
              const outputTypes: Record<string, string> = {
                draft_reply: '✉️ AI 生成了一封回信草稿',
                decision_card: '📋 AI 生成了决策分析卡',
                journal: '📓 AI 生成了日记草稿',
                letter: '💌 AI 生成了一封信件草稿',
                emotion_card: '🎴 AI 生成了情绪卡片',
              }
              const hint = outputTypes[outputData.output_type] || '📄 AI 生成了新内容'
              setBubbles((prev) => [...prev, { id: nextId(), role: 'assistant', content: `💡 ${hint}（可在「生成内容」页面查看）` }])
            } catch {}
            break

          case 'error':
            setBubbles((prev) => [...prev, { id: nextId(), role: 'assistant', content: `⚠️ ${event.content}` }])
            break

          case 'done':
            if (event.content) {
              try {
                const { conversation_id } = JSON.parse(event.content)
                if (conversation_id) {
                  setConvId(conversation_id)
                  if (!convId) router.replace(`/chat/${conversation_id}`)
                }
              } catch {}
            }
            break

          case 'session_end':
            try {
              const sessionData = JSON.parse(event.content)
              setBubbles((prev) => [...prev, {
                id: nextId(), role: 'assistant',
                content: `🌙 今天到这里\n\n${sessionData.summary || ''}${sessionData.topic ? '\n\n聊了：' + sessionData.topic : ''}\n\n明天见 :)`,
              }])
              setSending(true)
              setTimeout(() => setSending(false), 5000)
            } catch {}
            break

          case 'rumination_hint':
            setRuminationHint({ visible: true, pattern: event.content })
            setTimeout(() => setRuminationHint({ visible: false, pattern: '' }), 10000)
            break

          case 'recall':
            try {
              const recallData = JSON.parse(event.content)
              setRecallBanner({ visible: true, count: recallData.count, summary: recallData.topMatch })
              setTimeout(() => setRecallBanner(null), 5000)
            } catch {}
            break

          case 'assessment':
          case 'tool_call':
            break
        }
      }

      showSilentHintFn()

      if (assistantContent) {
        const replies = mode === 'emergency'
          ? ['好一点了', '还是很难受', '不想说了']
          : mode === 'low_power'
            ? ['说完了', '明天聊', '晚安']
            : ['嗯，继续说', '我懂了', '换个话题', '今天就这样']
        setQuickReplies(replies)
        setTimeout(() => setQuickReplies([]), 15000)
      }

      if (assistantContent && mode !== 'emergency' && mode !== 'low_power') {
        const vp = await db.getVoiceProfile()
        if (vp.enabled && vp.auto_play) {
          handlePlayVoice(assistantBubbleId, assistantContent)
        }
      }
    } catch (err) {
      setBubbles((prev) => [...prev, {
        id: nextId(), role: 'assistant',
        content: `⚠️ 发送失败：${err instanceof Error ? err.message : '未知错误'}`,
      }])
    } finally {
      setSending(false)
      setLastActivityTime(Date.now())
    }
  }, [input, sending, convId, mode, selectedImage, showSilentHintFn, handlePlayVoice])

  const renderBubble = useCallback(({ item }: { item: Bubble }) => {
    return (
      <ChatBubble
        role={item.role}
        content={item.content}
        theme={theme}
        showThinking={showThinking}
        isPlaying={playingBubbleId === item.id}
        isPaused={pausedBubbleId === item.id}
        onPlay={() => handlePlayVoice(item.id, item.content)}
        onStop={handleStopVoice}
        onPause={handlePauseVoice}
        onResume={handleResumeVoice}
        playbackSpeed={playingBubbleId === item.id ? playbackSpeed : undefined}
      />
    )
  }, [theme, playingBubbleId, pausedBubbleId, playbackSpeed, handlePlayVoice, handleStopVoice, handlePauseVoice, handleResumeVoice, showThinking])

  const s = makeStyles(theme)

  return (
    <KeyboardAvoidingView
      style={[s.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 44 : 0}
    >
      <Stack.Screen
        options={{
          title: '雨声',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.push('/conversations')} style={{ marginRight: 12 }}>
              <Text style={{ color: theme.textMuted, fontSize: 13 }}>‹ 历史</Text>
            </TouchableOpacity>
          ),
          headerRight: () => {
            const shareConv = async () => {
              const msgs = bubbles.map(b => (b.role === 'user' ? '我' : 'AI') + ': ' + b.content).join('\n\n')
              await Share.share({ message: msgs || '（暂无内容）' })
            }
            return (
              <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
                <TouchableOpacity onPress={shareConv} style={{ marginRight: 4 }}>
                  <Text style={{ color: theme.textMuted, fontSize: 13 }}>分享</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => router.push('/settings')}>
                  <Text style={{ color: theme.textMuted, fontSize: 13 }}>⚙</Text>
                </TouchableOpacity>
                <ModeSelector currentMode={mode} onSelect={setMode} theme={theme} />
              </View>
            )
          },
        }}
      />

      <ModeBadge mode={mode} theme={theme} />

      {mode === 'low_power' && currentRound > 0 && (
        <Text style={{ color: theme.textMuted, fontSize: 12, textAlign: 'center', paddingVertical: 4 }}>
          ⚡ 剩余 {Math.max(0, 2 - currentRound)} 轮
        </Text>
      )}

      <FlatList
        ref={flatListRef}
        data={bubbles}
        renderItem={renderBubble}
        keyExtractor={(item) => item.id}
        style={s.list}
        contentContainerStyle={s.listContent}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={() => Keyboard.dismiss()}
        ListEmptyComponent={
          <View style={s.emptyContainer}>
            <Text style={s.emptyTitle}>开始倾诉</Text>
            <Text style={s.emptyDesc}>说出你的感受，我会认真听</Text>
            <View style={s.promptRow}>
              {getRandomPrompts(4).map((prompt, i) => (
                <TouchableOpacity
                  key={i}
                  style={[s.promptChip, { backgroundColor: theme.surface, borderColor: theme.border }]}
                  onPress={() => handleSend(prompt)}
                >
                  <Text style={[s.promptChipText, { color: theme.textSecondary }]}>{prompt}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={[s.idkBtn, { backgroundColor: theme.surfaceLight, borderColor: theme.border }]}
              onPress={() => handleSend('我不知道说什么')}
            >
              <Text style={[s.idkBtnText, { color: theme.textMuted }]}>🤷 不知道说什么</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {quickReplies.length > 0 && bubbles.length > 0 && (
        <View style={[s.quickReplyRow, { backgroundColor: theme.background }]}>
          <View style={s.quickReplyScroll}>
            {quickReplies.map((reply, i) => (
              <TouchableOpacity
                key={i}
                style={[s.quickReplyChip, { backgroundColor: theme.surface, borderColor: theme.accent + '44' }]}
                onPress={() => handleSend(reply)}
              >
                <Text style={[s.quickReplyText, { color: theme.accent }]}>{reply}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {mode === 'emergency' && (
        <TouchableOpacity
          style={{ marginHorizontal: 16, marginBottom: 8, padding: 14, borderRadius: 12, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.accent, alignItems: 'center' }}
          onPress={() => setShowGrounding(true)}
        >
          <Text style={{ color: theme.text, fontSize: 15, fontWeight: '600' }}>🫂 做 grounding 练习</Text>
        </TouchableOpacity>
      )}

      {silentHint && (
        <View style={s.silentHintContainer}>
          <Text style={s.silentHintText}>说完了就不用说了，在这里待一会儿也行</Text>
        </View>
      )}

      {moodSavedHint && (
        <View style={s.silentHintContainer}>
          <Text style={[s.silentHintText, { color: theme.success }]}>✅ 已记录</Text>
        </View>
      )}

      {ruminationHint.visible && (
        <View style={[s.ruminationBanner, { backgroundColor: theme.surface, borderLeftColor: theme.warning }]}>
          <Text style={s.ruminationIcon}>🔄</Text>
          <View style={s.ruminationContent}>
            <Text style={[s.ruminationTitle, { color: theme.text }]}>注意到你在反复想同一件事</Text>
            {ruminationHint.pattern ? (
              <Text style={[s.ruminationDesc, { color: theme.textSecondary }]}>{ruminationHint.pattern}</Text>
            ) : null}
            <Text style={[s.ruminationTip, { color: theme.textMuted }]}>要不要试试换个角度，或者做个 grounding 练习？</Text>
          </View>
          <TouchableOpacity onPress={() => setRuminationHint({ visible: false, pattern: '' })}>
            <Text style={{ color: theme.textMuted, fontSize: 16 }}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {recallBanner && recallBanner.visible && (
        <View style={s.recallBanner}>
          <Text style={s.recallText}>💭 提到了一件往事... "{recallBanner.summary}"</Text>
        </View>
      )}

      <MoodPicker
        visible={showMoodPicker}
        onClose={() => { setShowMoodPicker(false); setMoodSavedHint(true); setTimeout(() => setMoodSavedHint(false), 3000) }}
        theme={theme}
      />

      <GroundingExercise
        visible={showGrounding}
        onClose={() => setShowGrounding(false)}
        theme={theme}
      />

      {suggestedActions.length > 0 && (
        <View style={[s.actionBar, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
          {suggestedActions.filter(a => a.status !== 'skipped').slice(-1).map(action => (
            <View key={action.id} style={s.actionRow}>
              <Text style={s.actionDesc}>🤚 {action.description}</Text>
              {action.status === 'suggested' ? (
                <View style={s.actionButtons}>
                  <TouchableOpacity style={[s.actionBtn, { backgroundColor: theme.success + '22' }]} onPress={() => handleActionDone(action.id)}>
                    <Text style={[s.actionBtnText, { color: theme.success }]}>✅ 做了</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.actionBtn, { backgroundColor: theme.textMuted + '22' }]} onPress={() => handleActionSkip(action.id)}>
                    <Text style={[s.actionBtnText, { color: theme.textMuted }]}>😅 没做</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <Text style={[s.actionStatus, { color: theme.success }]}>✅ 已做</Text>
              )}
            </View>
          ))}
        </View>
      )}

      <View style={[s.inputArea, { borderTopColor: theme.border }]}>
        {selectedImage && (
          <View style={s.imagePreviewRow}>
            <Image source={{ uri: `data:${selectedImage.media_type};base64,${selectedImage.data}` }} style={s.imagePreview} />
            <TouchableOpacity onPress={() => setSelectedImage(null)} style={[s.imageRemove, { backgroundColor: theme.danger }]}>
              <Text style={s.imageRemoveText}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={s.inputRow}>
          <TouchableOpacity style={[s.actionBtn, { backgroundColor: theme.surface }]} onPress={() => setShowMoodPicker(true)}>
            <Text style={s.actionBtnText}>😊</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.actionBtn, { backgroundColor: theme.surface }]} onPress={handlePickImage}>
            <Text style={s.actionBtnText}>🖼</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.actionBtn, listening && { backgroundColor: theme.danger }, !listening && { backgroundColor: theme.surface }]}
            onPress={handleVoice}
          >
            <Text style={s.actionBtnText}>{listening ? '🔴' : '🎤'}</Text>
          </TouchableOpacity>
          <TextInput
            style={[s.input, { backgroundColor: theme.surface, color: theme.text }]}
            value={input}
            onChangeText={setInput}
            placeholder={mode === 'emergency' ? '难受就说出来...' : mode === 'journal' ? '写下你的想法...' : '说点什么...'}
            placeholderTextColor={theme.textMuted}
            multiline
            maxLength={2000}
            editable={!sending}
          />
          <TouchableOpacity
            style={[s.sendButton, { backgroundColor: theme.accent }, sending && s.sendButtonDisabled]}
            onPress={() => handleSend()}
            disabled={sending || !input.trim()}
          >
            {sending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.sendText}>发送</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

function makeStyles(theme: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1 },
    list: { flex: 1 },
    listContent: { padding: 16, paddingBottom: 8 },
    emptyContainer: { alignItems: 'center', justifyContent: 'center', flex: 1, paddingTop: 100 },
    emptyTitle: { fontSize: 22, fontWeight: '600', color: theme.textMuted },
    emptyDesc: { fontSize: 15, color: theme.textMuted, marginTop: 12, marginBottom: 24 },
    promptRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, paddingHorizontal: 8, marginBottom: 16 },
    promptChip: { borderRadius: 16, paddingHorizontal: 18, paddingVertical: 12, borderWidth: 1 },
    promptChipText: { fontSize: 14, lineHeight: 20 },
    openingBanner: { marginHorizontal: 16, marginBottom: 8, borderRadius: 12, padding: 14, borderWidth: 1, position: 'relative' },
    openingText: { color: theme.text, fontSize: 15, lineHeight: 22 },
    openingHint: { color: theme.textMuted, fontSize: 11, marginTop: 6 },
    openingClose: { position: 'absolute', top: 8, right: 10, padding: 4 },
    silentHintContainer: { alignItems: 'center', paddingVertical: 4 },
    silentHintText: { color: theme.textMuted, fontSize: 12, opacity: 0.6, fontStyle: 'italic' as const },
    ruminationBanner: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 8, borderRadius: 12, padding: 12, borderLeftWidth: 4, alignItems: 'flex-start', gap: 10 },
    ruminationIcon: { fontSize: 20 },
    ruminationContent: { flex: 1 },
    ruminationTitle: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
    ruminationDesc: { fontSize: 13, lineHeight: 18, marginBottom: 4 },
    ruminationTip: { fontSize: 12, lineHeight: 16 },
    recallBanner: { alignItems: 'center', paddingVertical: 6, paddingHorizontal: 16 },
    recallText: { color: theme.textMuted, fontSize: 12, fontStyle: 'italic' as const, opacity: 0.7 },
    actionBar: { paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1 },
    actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    actionDesc: { color: theme.textSecondary, fontSize: 14, flex: 1 },
    actionButtons: { flexDirection: 'row', gap: 6 },
    actionBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
    actionBtnText: { fontSize: 13, fontWeight: '600' },
    actionStatus: { fontSize: 13, fontWeight: '600' },
    inputArea: { borderTopWidth: 1 },
    inputRow: { flexDirection: 'row', padding: 8, alignItems: 'flex-end', gap: 6 },
    imagePreviewRow: { flexDirection: 'row', paddingHorizontal: 12, paddingTop: 8, alignItems: 'center', gap: 8 },
    imagePreview: { width: 60, height: 60, borderRadius: 8, backgroundColor: theme.surface },
    imageRemove: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    imageRemoveText: { color: '#fff', fontSize: 12, fontWeight: '700' },
    input: { flex: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 16, maxHeight: 100 },
    sendButton: { borderRadius: 20, paddingHorizontal: 20, paddingVertical: 10, marginLeft: 8, minWidth: 60, alignItems: 'center' },
    sendButtonDisabled: { opacity: 0.5 },
    sendText: { color: '#fff', fontWeight: '600' },
    quickReplyRow: { paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: 0 },
    quickReplyScroll: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
    quickReplyChip: { borderRadius: 18, paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1 },
    quickReplyText: { fontSize: 14, fontWeight: '500' },
    idkBtn: { marginTop: 16, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24, borderWidth: 1, alignItems: 'center' },
    idkBtnText: { fontSize: 14, fontWeight: '500' },
  })
}
