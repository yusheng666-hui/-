// 小组件数据桥接 — 写入共享数据供原生 Widget 读取

import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'
import * as db from './db'

const WIDGET_DATA_KEY = '@widget:data'

export type WidgetData = {
  todayMood: string         // emoji or ''
  streak: number
  checkedIn: boolean
  updatedAt: string
}

export async function syncWidgetData(): Promise<void> {
  try {
    const checkins = await db.getMoodCheckins()
    const today = new Date().toISOString().slice(0, 10)
    const todayCheck = checkins.find(c => c.date === today)

    // 计算连续签到
    let streak = 0
    for (let i = 0; i < 365; i++) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      if (checkins.find(c => c.date === key)) {
        streak++
      } else if (i !== 0) {
        break
      }
    }

    const widgetData: WidgetData = {
      todayMood: todayCheck?.emoji || '',
      streak,
      checkedIn: !!todayCheck,
      updatedAt: new Date().toISOString(),
    }

    // 存储到 AsyncStorage
    await AsyncStorage.setItem(WIDGET_DATA_KEY, JSON.stringify(widgetData))

    // iOS: 通过 UserDefaults (App Group) 共享
    if (Platform.OS === 'ios') {
      try {
        const RN = require('react-native')
        const userDefaults = RN.NativeModules?.RNUserDefaults
        if (userDefaults?.set) {
          await userDefaults.set('group.com.emotional.rescue', WIDGET_DATA_KEY, JSON.stringify(widgetData))
        }
      } catch {}
    }
  } catch {}
}

export async function getWidgetData(): Promise<WidgetData | null> {
  try {
    const raw = await AsyncStorage.getItem(WIDGET_DATA_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}
