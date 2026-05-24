import { Text } from 'react-native'
import { Tabs } from 'expo-router'
import { useTheme } from '../../lib/theme-context'

export default function TabLayout() {
  const { theme } = useTheme()

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopColor: theme.border,
        },
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.textMuted,
      }}
    >
      <Tabs.Screen name="index" options={{ title: '首页', tabBarIcon: () => <Text>🏠</Text> }} />
      <Tabs.Screen name="chat" options={{ title: '对话', tabBarIcon: () => <Text>💬</Text> }} />
      <Tabs.Screen name="growth" options={{ title: '成长', tabBarIcon: () => <Text>🌱</Text> }} />
      <Tabs.Screen name="settings" options={{ title: '设置', tabBarIcon: () => <Text>⚙️</Text> }} />
    </Tabs>
  )
}
