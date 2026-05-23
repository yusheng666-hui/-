import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useTheme } from '../lib/theme-context'
import type { ThemeColors } from '../lib/theme'
import { Component, type PropsWithChildren } from 'react'

type Props = PropsWithChildren<{}>
type State = { hasError: boolean; error?: Error }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} onReset={() => this.setState({ hasError: false })} />
    }
    return this.props.children
  }
}

function ErrorFallback({ error, onReset }: { error?: Error; onReset: () => void }) {
  const { theme } = useTheme()
  const s = makeStyles(theme)
  return (
    <View style={s.container}>
      <Text style={s.emoji}>😵</Text>
      <Text style={s.title}>出了点问题</Text>
      <Text style={s.desc}>App 遇到了一个意外错误，你可以尝试重新加载</Text>
      <Text style={s.errorText}>{error?.message || '未知错误'}</Text>
      <TouchableOpacity style={s.button} onPress={onReset}>
        <Text style={s.buttonText}>重新加载</Text>
      </TouchableOpacity>
    </View>
  )
}

function makeStyles(theme: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: theme.background },
    emoji: { fontSize: 48, marginBottom: 16 },
    title: { fontSize: 20, fontWeight: '700', color: theme.text, marginBottom: 8 },
    desc: { fontSize: 14, color: theme.textSecondary, textAlign: 'center', marginBottom: 12 },
    errorText: { fontSize: 12, color: theme.danger, marginBottom: 24, textAlign: 'center', opacity: 0.7 },
    button: { backgroundColor: theme.accent, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 32 },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  })
}
