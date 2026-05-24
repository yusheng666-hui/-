import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { useTheme } from '../../lib/theme-context'
import { THEMES, type ThemeKey } from '../../lib/theme'

const THEME_OPTIONS: { key: ThemeKey; label: string; emoji: string }[] = [
  { key: 'soft_pink', label: '柔粉', emoji: '🌸' },
  { key: 'ocean_dream', label: '海洋', emoji: '🌊' },
  { key: 'pure_white', label: '纯白', emoji: '🤍' },
  { key: 'warm_cream', label: '暖白', emoji: '🍂' },
  { key: 'deep_purple', label: '深紫', emoji: '💜' },
  { key: 'warm_sunset', label: '暖阳', emoji: '🌅' },
  { key: 'amoled_black', label: '纯黑', emoji: '🖤' },
]

export default function SettingsTab() {
  const { theme, themeKey, setThemeKey } = useTheme()

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={styles.container}
    >
      <Text style={[styles.title, { color: theme.text }]}>设置</Text>

      <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>主题颜色</Text>
      <View style={styles.themeGrid}>
        {THEME_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.key}
            style={[
              styles.themeCard,
              {
                backgroundColor: THEMES[opt.key].accent + '15',
                borderColor: themeKey === opt.key ? theme.accent : 'transparent',
              },
            ]}
            onPress={() => setThemeKey(opt.key)}
          >
            <Text style={styles.themeEmoji}>{opt.emoji}</Text>
            <Text
              style={[
                styles.themeLabel,
                {
                  color: themeKey === opt.key ? theme.accent : theme.textSecondary,
                  fontWeight: themeKey === opt.key ? '600' : '400',
                },
              ]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.fullSettingsBtn, { backgroundColor: theme.accent }]}
        onPress={() => router.push('/settings')}
      >
        <Text style={styles.fullSettingsText}>完整设置</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 48, paddingBottom: 100 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 24 },
  sectionLabel: { fontSize: 14, fontWeight: '600', marginBottom: 12 },
  themeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 32 },
  themeCard: {
    borderRadius: 14, padding: 16, alignItems: 'center',
    width: '30%', borderWidth: 2, aspectRatio: 1,
    justifyContent: 'center',
  },
  themeEmoji: { fontSize: 28, marginBottom: 6 },
  themeLabel: { fontSize: 13 },
  fullSettingsBtn: { borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  fullSettingsText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})
