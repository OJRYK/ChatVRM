export type AIService =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'localLlm'
  | 'azure'
  | 'groq'
  | 'cohere'
  | 'mistralai'
  | 'perplexity'
  | 'fireworks'
  | 'dify'
  | 'deepseek'

export interface AIServiceConfig {
  openai: { key: string; model: string }
  anthropic: { key: string; model: string }
  google: { key: string; model: string }
  localLlm: { url: string; model: string }
  azure: { key: string; model: string }
  groq: { key: string; model: string }
  cohere: { key: string; model: string }
  mistralai: { key: string; model: string }
  perplexity: { key: string; model: string }
  fireworks: { key: string; model: string }
  dify: {
    key: string
    url: string
    conversationId: string
  }
  deepseek: { key: string; model: string }
}

export type AIVoice =
  | 'koeiromap'
  | 'google'
  | 'voicevox'
  | 'stylebertvits2'
  | 'aivis_speech'
  | 'nijivoice'
  | 'gsvitts'
  | 'elevenlabs'
  | 'openai'
  | 'azure'

export type Language = (typeof LANGUAGES)[number]

export const LANGUAGES = [
  'en',
  'ja',
  'ko',
  'zh',
  'vi',
  'fr',
  'es',
  'pt',
  'de',
  'ru',
  'it',
  'ar',
  'hi',
  'pl',
  'th',
] as const

export const isLanguageSupported = (language: string): language is Language =>
  LANGUAGES.includes(language as Language)

export type VoiceLanguage =
  | 'en-US'
  | 'ja-JP'
  | 'ko-KR'
  | 'zh-TW'
  | 'vi-VN'
  | 'fr-FR'
  | 'es-ES'
  | 'pt-PT'
  | 'de-DE'
  | 'ru-RU'
  | 'it-IT'
  | 'ar-SA'
  | 'hi-IN'
  | 'pl-PL'
  | 'th-TH'

export type OpenAITTSVoice =
  | 'alloy'
  | 'echo'
  | 'fable'
  | 'onyx'
  | 'nova'
  | 'shimmer'
export type OpenAITTSModel = 'tts-1' | 'tts-1-hd'

export type RealtimeAPIModeModel =
  | 'gpt-4o-realtime-preview-2024-10-01'
  | 'gpt-4o-realtime-preview-2024-12-17'
  | 'gpt-4o-mini-realtime-preview-2024-12-17'
export type RealtimeAPIModeContentType = 'input_text' | 'input_audio'
export type RealtimeAPIModeVoice =
  | 'alloy'
  | 'ash'
  | 'ballad'
  | 'coral'
  | 'echo'
  | 'sage'
  | 'shimmer'
  | 'verse'
export type RealtimeAPIModeAzureVoice =
  | 'alloy'
  | 'amuch'
  | 'breeze'
  | 'cove'
  | 'dan'
  | 'echo'
  | 'elan'
  | 'ember'
  | 'jupiter'
  | 'marilyn'
  | 'shimmer'

export type AudioModeModel =
  | 'gpt-4o-audio-preview-2024-10-01'
  | 'gpt-4o-audio-preview-2024-12-17'
  | 'gpt-4o-mini-audio-preview-2024-12-17'
export type AudioModeInputType = 'input_text' | 'input_audio'

// 音声のみモードの設定
export const DEFAULT_VAD_SENSITIVITY = 0.5 // デフォルトのVAD感度
export const MIN_VAD_SENSITIVITY = 0.0 // 最小VAD感度
export const MAX_VAD_SENSITIVITY = 1.0 // 最大VAD感度
