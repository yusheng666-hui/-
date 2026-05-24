// 主题颜色系统 — 支持暖色调切换

import { KEYS, getItem, setItem } from './storage'

export type ThemeKey = 'pure_white' | 'warm_cream' | 'soft_pink' | 'deep_purple' | 'warm_sunset' | 'amoled_black' | 'ocean_dream'

export type ThemeColors = {
  background: string
  surface: string
  surfaceLight: string
  accent: string
  accentLight: string
  accentMuted: string
  border: string
  text: string
  textSecondary: string
  textMuted: string
  textInverse: string
  danger: string
  success: string
  warning: string
}

const THEMES: Record<ThemeKey, ThemeColors> = {
  // 纯白 — 白底，暖桃色点缀
  pure_white: {
    background: '#ffffff',
    surface: '#f5f2ef',
    surfaceLight: '#ece6e0',
    accent: '#e8a87c',
    accentLight: '#f0c4a8',
    accentMuted: '#d4946c',
    border: '#e0d8d0',
    text: '#2a2218',
    textSecondary: '#5a4e44',
    textMuted: '#9a9288',
    textInverse: '#fff',
    danger: '#d46060',
    success: '#6b9e6b',
    warning: '#c4944a',
  },
  // 暖白 — 奶油白底，暖棕点缀
  warm_cream: {
    background: '#fdf6ee',
    surface: '#f5ede4',
    surfaceLight: '#ece2d6',
    accent: '#d4a07a',
    accentLight: '#e8bca0',
    accentMuted: '#c08864',
    border: '#e0d4c8',
    text: '#2a2018',
    textSecondary: '#5a4a40',
    textMuted: '#9a8a80',
    textInverse: '#fff',
    danger: '#d46060',
    success: '#6b9e6b',
    warning: '#c4944a',
  },
  // 柔粉 — 浅粉底，玫瑰色点缀
  soft_pink: {
    background: '#fdf0f5',
    surface: '#f5e6ee',
    surfaceLight: '#ecdce6',
    accent: '#e08aa8',
    accentLight: '#f0b0c8',
    accentMuted: '#c8708e',
    border: '#e0d0d8',
    text: '#2a1820',
    textSecondary: '#5a3848',
    textMuted: '#9a7888',
    textInverse: '#fff',
    danger: '#d46070',
    success: '#6b9e7b',
    warning: '#c4945a',
  },
  // 深空紫（默认暗色）
  deep_purple: {
    background: '#1a1a2e',
    surface: '#16213e',
    surfaceLight: '#1e2a4a',
    accent: '#533483',
    accentLight: '#7b5ea7',
    accentMuted: '#3d2260',
    border: '#0f3460',
    text: '#e0e0e0',
    textSecondary: '#ccc',
    textMuted: '#888',
    textInverse: '#fff',
    danger: '#8b0000',
    success: '#2e8b57',
    warning: '#b8860b',
  },
  // AMOLED 纯黑 — 纯黑底，紫罗兰点缀
  amoled_black: {
    background: '#000000',
    surface: '#0a0a0a',
    surfaceLight: '#1a1a1a',
    accent: '#bb86fc',
    accentLight: '#d0a6ff',
    accentMuted: '#8858d0',
    border: '#222222',
    text: '#e0e0e0',
    textSecondary: '#b0b0b0',
    textMuted: '#707070',
    textInverse: '#000',
    danger: '#cf6679',
    success: '#6b9e6b',
    warning: '#c4943a',
  },
  // 海洋之梦 — 清新蓝紫，年轻用户最爱
  ocean_dream: {
    background: '#f0f4ff',
    surface: '#ffffff',
    surfaceLight: '#e8eefa',
    accent: '#6366f1',
    accentLight: '#818cf8',
    accentMuted: '#4f46e5',
    border: '#dde4f0',
    text: '#1e293b',
    textSecondary: '#475569',
    textMuted: '#94a3b8',
    textInverse: '#fff',
    danger: '#ef4444',
    success: '#10b981',
    warning: '#f59e0b',
  },
  // 暖阳橙（中暖暗色）
  warm_sunset: {
    background: '#1e1410',
    surface: '#2a1f1a',
    surfaceLight: '#3a2c24',
    accent: '#c97b5d',
    accentLight: '#e8a87c',
    accentMuted: '#8a5a44',
    border: '#4a3428',
    text: '#e8ddd0',
    textSecondary: '#d4c5b8',
    textMuted: '#a09080',
    textInverse: '#fff',
    danger: '#cc4444',
    success: '#6b9e6b',
    warning: '#c4943a',
  },
}

const THEME_KEY = KEYS.THEME || 'app_theme'

export async function getThemeKey(): Promise<ThemeKey> {
  const stored = await getItem(THEME_KEY)
  if (stored && stored in THEMES) return stored as ThemeKey
  return 'soft_pink'
}

export async function setThemeKey(key: ThemeKey): Promise<void> {
  await setItem(THEME_KEY, key)
}

export async function getTheme(): Promise<ThemeColors> {
  const key = await getThemeKey()
  return THEMES[key]
}

export function getThemeSync(key: ThemeKey): ThemeColors {
  return THEMES[key] || THEMES.deep_purple
}

export { THEMES, THEME_KEY }
