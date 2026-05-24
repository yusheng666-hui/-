import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native'
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

const QUICK_LINKS = [
  { emoji: '🔑', label: 'API 配置', desc: '设置 AI 接口密钥', route: '/settings' },
  { emoji: '🔊', label: '语音设置', desc: 'TTS 朗读与语速', route: '/settings' },
  { emoji: '📊', label: '数据管理', desc: '导出与备份数据', route: '/settings' },
  { emoji: '📋', label: '关于雨声', desc: '版本与帮助信息', route: '/settings' },
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

      <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>更多设置</Text>
      {QUICK_LINKS.map((link) => (
        <TouchableOpacity
          key={link.label}
          style={[styles.linkCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
          onPress={() => router.push(link.route)}
        >
          <Text style={styles.linkEmoji}>{link.emoji}</Text>
          <View style={styles.linkText}>
            <Text style={[styles.linkLabel, { color: theme.text }]}>{link.label}</Text>
            <Text style={[styles.linkDesc, { color: theme.textMuted }]}>{link.desc}</Text>
          </View>
          <Text style={[styles.linkArrow, { color: theme.textMuted }]}>›</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 48, paddingBottom: 100 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 24 },
  sectionLabel: { fontSize: 14, fontWeight: '600', marginBottom: 12, marginTop: 8 },
  themeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 28 },
  themeCard: {
    borderRadius: 14, padding: 16, alignItems: 'center',
    width: '30%', borderWidth: 2, aspectRatio: 1,
    justifyContent: 'center',
  },
  themeEmoji: { fontSize: 28, marginBottom: 6 },
  themeLabel: { fontSize: 13 },
  linkCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1 },
  linkEmoji: { fontSize: 28, marginRight: 14 },
  linkText: { flex: 1 },
  linkLabel: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
  linkDesc: { fontSize: 13 },
  linkArrow: { fontSize: 22 },
})
