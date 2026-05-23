// App Shortcuts — 主屏幕快捷操作

import * as QuickActions from 'expo-quick-actions'
import { router } from 'expo-router'

export type ShortcutType = 'checkin' | 'emergency' | 'chat'

export function registerShortcuts() {
  QuickActions.setItems([
    {
      id: 'checkin',
      title: '心情签到',
      icon: 'mood',
      params: { route: 'checkin' },
    },
    {
      id: 'emergency',
      title: '急救模式',
      icon: 'alert',
      params: { route: 'emergency' },
    },
    {
      id: 'chat',
      title: '继续对话',
      icon: 'message',
      params: { route: 'chat' },
    },
  ])
}

export function setupShortcutHandler() {
  // expo-quick-actions fires an event when user taps a shortcut
  QuickActions.addListener((event) => {
    const route = event.params?.route as string | undefined
    if (route === 'checkin') {
      router.push('/')
    } else if (route === 'emergency') {
      router.push('/chat/new?mode=emergency')
    } else if (route === 'chat') {
      router.push('/conversations')
    }
  })
}
