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
  const DARK_THEMES: string[] = ['deep_purple', 'warm_sunset', 'amoled_black']
  const darkMode = DARK_THEMES.includes(themeKey)

  useEffect(() => {
    ;(async () => {
      const profile = await db.getProfile()
      setShowEmergencyBtn(profile.show_emergency_button !== false)

      await initNotifications()

      try {
        const { syncWidgetData } = await import('../lib/widget-bridge')
        await syncWidgetData()
      } catch {}

      registerShortcuts()
      setupShortcutHandler()

      setupNotificationResponseHandler(() => {})
    })()
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      checkTodayAndReschedule()
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  return (
    <ErrorBoundary>
      <View style={{ flex: 1 }}>
        <StatusBar style={darkMode ? 'light' : 'dark'} />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="chat/[id]" options={{ title: '雨声', headerBackTitle: '返回', headerStyle: { backgroundColor: theme.surface }, headerTintColor: theme.text }} />
          <Stack.Screen name="settings" options={{ title: '设置', headerBackTitle: '返回', headerStyle: { backgroundColor: theme.surface }, headerTintColor: theme.text }} />
          <Stack.Screen name="conversations" options={{ title: '历史对话', headerBackTitle: '返回', headerStyle: { backgroundColor: theme.surface }, headerTintColor: theme.text }} />
          <Stack.Screen name="memories" options={{ title: '记忆库', headerBackTitle: '返回', headerStyle: { backgroundColor: theme.surface }, headerTintColor: theme.text }} />
          <Stack.Screen name="insights" options={{ title: '情绪洞察', headerBackTitle: '返回', headerStyle: { backgroundColor: theme.surface }, headerTintColor: theme.text }} />
          <Stack.Screen name="outputs" options={{ title: '生成内容', headerBackTitle: '返回', headerStyle: { backgroundColor: theme.surface }, headerTintColor: theme.text }} />
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
