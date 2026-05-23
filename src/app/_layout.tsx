import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { ThemeProvider, useTheme } from '../lib/theme-context'
import { ErrorBoundary } from '../components/error-boundary'
import EmergencyFloatingBtn from '../components/emergency-floating-btn'
import * as db from '../lib/db'
import { initNotifications, setupNotificationResponseHandler, checkTodayAndReschedule } from '../lib/notifications'
import { registerShortcuts, setupShortcutHandler } from '../lib/quick-actions'

function RootLayoutInner() {
  const { themeKey, theme } = useTheme()
  const [showEmergencyBtn, setShowEmergencyBtn] = useState(true)
  const darkMode = themeKey === 'deep_purple' || themeKey === 'warm_sunset'

  useEffect(() => {
    ;(async () => {
      const profile = await db.getProfile()
      setShowEmergencyBtn(profile.show_emergency_button !== false)

      // 初始化通知
      await initNotifications()

      // 同步小组件数据
      try {
        const { syncWidgetData } = await import('../lib/widget-bridge')
        await syncWidgetData()
      } catch {}

      // 注册快捷操作
      registerShortcuts()
      setupShortcutHandler()

      // 通知响应处理（点击后回到首页）
      setupNotificationResponseHandler(() => {
        // 用户点击签到通知，回到首页
      })
    })()
  }, [])

  // App 回到前台时检查通知状态（签到后取消当天提醒）
  useEffect(() => {
    const interval = setInterval(() => {
      checkTodayAndReschedule()
    }, 60000) // 每分钟检查一次
    return () => clearInterval(interval)
  }, [])

  return (
    <ErrorBoundary>
      <View style={{ flex: 1 }}>
        <StatusBar style={darkMode ? 'light' : 'dark'} />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: theme.surface },
            headerTintColor: theme.text,
            headerTitleStyle: { fontWeight: '600' },
          }}
        >
          <Stack.Screen name="index" options={{ title: '雨声' }} />
          <Stack.Screen
            name="chat/[id]"
            options={{ title: '雨声', headerBackTitle: '返回' }}
          />
          <Stack.Screen
            name="settings"
            options={{ title: '设置', headerBackTitle: '返回' }}
          />
          <Stack.Screen
            name="conversations"
            options={{ title: '历史对话', headerBackTitle: '返回' }}
          />
          <Stack.Screen
            name="memories"
            options={{ title: '记忆库', headerBackTitle: '返回' }}
          />
          <Stack.Screen
            name="insights"
            options={{ title: '情绪洞察', headerBackTitle: '返回' }}
          />
          <Stack.Screen
            name="outputs"
            options={{ title: '生成内容', headerBackTitle: '返回' }}
          />
        </Stack>

        <EmergencyFloatingBtn visible={showEmergencyBtn} theme={theme} />
      </View>
    </ErrorBoundary>
  )
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootLayoutInner />
    </ThemeProvider>
  )
}
