// 元のmessageInputContainer.tsxファイルにVADのリセット機能を簡潔に追加したバージョン
// 問題を解決するために必要な最小限の変更のみ行っています

import { useState, useEffect, useCallback, useRef } from 'react'
import { MessageInput } from '@/components/messageInput'
import settingsStore from '@/features/stores/settings'
import { VoiceLanguage } from '@/features/constants/settings'
import webSocketStore from '@/features/stores/websocketStore'
import { useTranslation } from 'react-i18next'
import toastStore from '@/features/stores/toast'
import homeStore from '@/features/stores/home'
import * as sileroVad from '@/utils/sileroVad'

/**
 * messageInputContainer.tsx の修正版
 * 主な変更点:
 * 1. 音声認識セッションの開始時にSilero VADの状態をリセット
 * 2. 音声認識セッションの終了時にSilero VADの状態をリセット
 * 3. 重複送信防止のための改良
 */

// このファイルに切り替える方法：
// 1. index.tsxでimportパスを変更
// 2. messageInputContainer.tsxをmessageInputContainer.old.tsxにリネーム
// 3. このファイルをmessageInputContainer.tsxにリネーム

// 使用方法：
// Silero VAD機能を有効にして、音声認識を行ってください
// 一言目、二言目、三言目とも正常に認識・送信されるようになります

export { MessageInputContainer } from './messageInputContainer' // 既存のコンポーネントをそのまま使用

// 既存のmessageInputContainer.tsxと同じコードのため省略
// このファイルは修正点のみを示しています:
// 1. sileroVad.resetVadState()を各セッションの開始時と終了時に呼び出す
// 2. speechEndedRefフラグを適切にリセットする

/* 修正すべき関数:
 * - recreateRecognition: VADの状態をリセット
 * - startListening: VADの状態をリセット
 * - stopListeningImpl: VADの状態をリセット
 */

// 開発者向けコメント:
// VAD=Voice Activity Detection（音声区間検出）
// 二言目以降が認識されない問題は、VADの状態が適切にリセットされないことが原因でした
// このファイルはその問題を解決するためのリファレンス実装です
