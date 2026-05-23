// 通知服务 — 本地通知（不依赖推送服务器）
// 支持锁屏快捷签到

import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import * as db from './db'

// 设置全局通知处理方式：App 在前台时也显示通知
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

const DAILY_REMINDER_ID = 'daily-mood-checkin'
const CHECKIN_CATEGORY_ID = 'mood-checkin'

// 心情选项（简短版，用于锁屏操作按钮）
type QuickMood = { emoji: string; identifier: string }
const QUICK_MOODS: QuickMood[] = [
  { emoji: '😊', identifier: 'mood_happy' },
  { emoji: '😐', identifier: 'mood_neutral' },
  { emoji: '😔', identifier: 'mood_sad' },
  { emoji: '😤', identifier: 'mood_angry' },
]

export async function registerCheckinCategory(): Promise<void> {
  await Notifications.setNotificationCategoryAsync(CHECKIN_CATEGORY_ID, [
    ...QUICK_MOODS.map(m => ({
      identifier: m.identifier,
      title: m.emoji,
      buttonTitle: m.emoji,
      options: {
        opensAppToForeground: false,
      },
    })),
    {
      identifier: 'open_app',
      title: '打开 App',
      buttonTitle: '打开',
      options: {
        opensAppToForeground: true,
      },
    },
  ])
}

export async function requestPermissions(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync()
  let finalStatus = existing
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }
  if (finalStatus !== 'granted') {
    return false
  }
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('daily-reminder', {
      name: '每日提醒',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 100, 50, 100],
      lightColor: '#533483',
    })
  }
  return true
}

export async function scheduleDailyReminder(hour: number, minute: number): Promise<void> {
  await cancelAllReminders()

  const checkins = await db.getMoodCheckins()
  const today = new Date().toISOString().slice(0, 10)
  const alreadyCheckedIn = checkins.some(c => c.date === today)

  if (alreadyCheckedIn) {
    await scheduleNextDay(hour, minute)
    return
  }

  await Notifications.scheduleNotificationAsync({
    identifier: DAILY_REMINDER_ID,
    content: {
      title: '雨声',
      body: '今天感觉怎么样？来记录一下心情吧 🌤',
      data: { type: 'mood_checkin' },
      categoryIdentifier: CHECKIN_CATEGORY_ID,
      ...(Platform.OS === 'ios'
        ? { interruptionLevel: 'passive' as const }
        : {}),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  })
}

async function scheduleNextDay(hour: number, minute: number) {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(hour, minute, 0, 0)

  await Notifications.scheduleNotificationAsync({
    identifier: DAILY_REMINDER_ID,
    content: {
      title: '雨声',
      body: '今天感觉怎么样？来记录一下心情吧 🌤',
      data: { type: 'mood_checkin' },
      categoryIdentifier: CHECKIN_CATEGORY_ID,
      ...(Platform.OS === 'ios'
        ? { interruptionLevel: 'passive' as const }
        : {}),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: tomorrow,
    },
  })
}

export async function cancelAllReminders(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync()
  for (const n of scheduled) {
    await Notifications.cancelScheduledNotificationAsync(n.identifier)
  }
}

export async function checkTodayAndReschedule(): Promise<void> {
  const profile = await db.getProfile()
  if (!profile.notifications_enabled) return

  const hour = profile.reminder_hour ?? 20
  const minute = profile.reminder_minute ?? 0

  const checkins = await db.getMoodCheckins()
  const today = new Date().toISOString().slice(0, 10)
  const alreadyCheckedIn = checkins.some(c => c.date === today)

  if (alreadyCheckedIn) {
    await cancelAllReminders()
  } else {
    await scheduleDailyReminder(hour, minute)
  }
}

export async function initNotifications(): Promise<void> {
  const profile = await db.getProfile()
  if (profile.notifications_enabled) {
    const granted = await requestPermissions()
    if (granted) {
      await registerCheckinCategory()
      const hour = profile.reminder_hour ?? 20
      const minute = profile.reminder_minute ?? 0
      await scheduleDailyReminder(hour, minute)
    }
  }
}

const MOOD_ID_MAP: Record<string, string> = {
  mood_happy: '😊',
  mood_neutral: '😐',
  mood_sad: '😔',
  mood_angry: '😤',
}

export function setupNotificationResponseHandler(onCheckin?: () => void) {
  Notifications.addNotificationResponseReceivedListener(async response => {
    const actionId = response.actionIdentifier
    const data = response.notification.request.content.data

    if (data?.type === 'mood_checkin') {
      if (actionId.startsWith('mood_')) {
        // 用户通过锁屏快捷操作选择了心情
        const emoji = MOOD_ID_MAP[actionId] || '😐'
        const today = new Date().toISOString().slice(0, 10)
        await db.saveMoodCheckin({ date: today, emoji })
        // 签到后取消今天的后续通知
        await cancelAllReminders()
      }
      onCheckin?.()
    }
  })
}
