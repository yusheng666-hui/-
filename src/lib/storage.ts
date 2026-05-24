import { Platform } from 'react-native'

// SecureStore 仅在原生设备可用，Web 回退到 localStorage
let getItemNative: (key: string) => Promise<string | null> = async () => null
let setItemNative: (key: string, value: string) => Promise<void> = async () => {}

if (Platform.OS !== 'web') {
  try {
    const SecureStore = require('expo-secure-store')
    getItemNative = (key: string) => SecureStore.getItemAsync(key)
    setItemNative = (key: string, value: string) => SecureStore.setItemAsync(key, value)
  } catch {}
}

const webStorage = typeof localStorage !== 'undefined' ? localStorage : null

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web' && webStorage) {
    return webStorage.getItem(key)
  }
  return getItemNative(key)
}

async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web' && webStorage) {
    webStorage.setItem(key, value)
    return
  }
  return setItemNative(key, value)
}

const KEYS = {
  ANTHROPIC_API_KEY: 'anthropic_api_key',
  OPENAI_API_KEY: 'openai_api_key',
  API_TYPE: 'api_type',
  API_BASE_URL: 'api_base_url',
  API_MODEL: 'api_model',
  PRIVACY_MODE: 'privacy_mode',
  THEME: 'app_theme',
  TTS_API_KEY: 'tts_api_key',
  TTS_PROVIDER: 'tts_provider',
  VOICE_CLONE_SERVER_URL: 'voice_clone_server_url',
  VOICE_CLONE_VOICE_ID: 'voice_clone_voice_id',
}

export type ApiType = 'openai' | 'anthropic'
export type ApiSettings = {
  type: ApiType
  baseUrl: string
  model: string
}

const DEFAULT_SETTINGS: ApiSettings = {
  type: 'anthropic',
  baseUrl: 'https://api.anthropic.com',
  model: 'claude-sonnet-4-20250514',
}

export async function saveApiKey(key: string, value: string) {
  await setItem(key, value)
}

export async function getApiKey(key: string): Promise<string | null> {
  return getItem(key)
}

export async function saveApiSettings(settings: ApiSettings): Promise<void> {
  await setItem(KEYS.API_TYPE, settings.type)
  await setItem(KEYS.API_BASE_URL, settings.baseUrl)
  await setItem(KEYS.API_MODEL, settings.model)
}

export async function getApiSettings(): Promise<ApiSettings> {
  const type = await getItem(KEYS.API_TYPE)
  const baseUrl = await getItem(KEYS.API_BASE_URL)
  const model = await getItem(KEYS.API_MODEL)
  return {
    type: (type as ApiType) || DEFAULT_SETTINGS.type,
    baseUrl: baseUrl || DEFAULT_SETTINGS.baseUrl,
    model: model || DEFAULT_SETTINGS.model,
  }
}

export async function hasAllKeys(): Promise<boolean> {
  const key = await getItem(KEYS.ANTHROPIC_API_KEY)
  return !!key
}

export { KEYS, getItem, setItem }
