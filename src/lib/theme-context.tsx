// 全局主题上下文 — 所有页面共享主题状态

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { getThemeKey, setThemeKey as setStoredThemeKey, THEMES, type ThemeKey, type ThemeColors } from './theme'

type ThemeContextValue = {
  theme: ThemeColors
  themeKey: ThemeKey
  setThemeKey: (key: ThemeKey) => Promise<void>
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeKey, setKey] = useState<ThemeKey>('soft_pink')
  const [theme, setTheme] = useState<ThemeColors>(THEMES.deep_purple)

  useEffect(() => {
    ;(async () => {
      const key = await getThemeKey()
      setKey(key)
      setTheme(THEMES[key])
    })()
  }, [])

  const handleSetThemeKey = async (key: ThemeKey) => {
    await setStoredThemeKey(key)
    setKey(key)
    setTheme(THEMES[key])
  }

  const value = useMemo(
    () => ({ theme, themeKey, setThemeKey: handleSetThemeKey }),
    [theme, themeKey],
  )

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    return {
      theme: THEMES.deep_purple,
      themeKey: 'soft_pink',
      setThemeKey: async () => {},
    }
  }
  return ctx
}
