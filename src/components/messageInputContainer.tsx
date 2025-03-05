import { useState, useEffect, useCallback, useRef } from 'react'
import { MessageInput } from '@/components/messageInput'
import settingsStore from '@/features/stores/settings'
import { VoiceLanguage } from '@/features/constants/settings'
import webSocketStore from '@/features/stores/websocketStore'
import { useTranslation } from 'react-i18next'
import toastStore from '@/features/stores/toast'
import homeStore from '@/features/stores/home'
import * as sileroVad from '@/utils/sileroVad'

// ブラウザ互換性のための型定義拡張
interface Window {
  webkitAudioContext: typeof AudioContext;
  SpeechRecognition?: typeof SpeechRecognition;
  webkitSpeechRecognition?: typeof SpeechRecognition;
}

// AudioContext の型定義を拡張
type AudioContextType = typeof AudioContext

// 音声認識開始後、音声が検出されないまま経過した場合のタイムアウト（5秒）
const INITIAL_SPEECH_TIMEOUT = 5000

// 無音検出用の状態と変数を追加
type Props = {
  onChatProcessStart: (text: string) => void
}

export const MessageInputContainer = ({ onChatProcessStart }: Props) => {
  const realtimeAPIMode = settingsStore((s) => s.realtimeAPIMode)
  const [userMessage, setUserMessage] = useState('')
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null)
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  
  // AudioContextの初期化
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        // 型安全なAudioContext初期化
        const AudioContextClass = window.AudioContext || 
          (window as any).webkitAudioContext;
          
        if (AudioContextClass && !audioContext) {
          console.log('🔊 AudioContextを初期化します');
          setAudioContext(new AudioContextClass());
        }
      } catch (e) {
        console.error('❌ AudioContextの初期化に失敗しました:', e);
      }
    }
  }, [audioContext]);
  const keyPressStartTime = useRef<number | null>(null)
  const transcriptRef = useRef('')
  const isKeyboardTriggered = useRef(false)
  const audioBufferRef = useRef<Float32Array | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const isListeningRef = useRef(false)
  const [isListening, setIsListening] = useState(false)
  const isSpeaking = homeStore((s) => s.isSpeaking)
  const voiceOnlyMode = settingsStore((s) => s.voiceOnlyMode)
  const vadSensitivity = settingsStore((s) => s.vadSensitivity)
  const voiceSilenceMinDuration = settingsStore((s) => s.voiceSilenceMinDuration)
  const alwaysListening = settingsStore((s) => s.alwaysListening)
  const audioBufferEnabled = settingsStore((s) => s.audioBufferEnabled)
  const audioBufferDuration = settingsStore((s) => s.audioBufferDuration)
  const interruptOnSpeechDetected = settingsStore((s) => s.interruptOnSpeechDetected)
  // 音声認識開始時刻を保持する変数を追加
  const recognitionStartTimeRef = useRef<number>(0)
  // 音声が検出されたかどうかのフラグ
  const speechDetectedRef = useRef<boolean>(false)
  // 初期音声検出用のタイマー
  const initialSpeechCheckTimerRef = useRef<NodeJS.Timeout | null>(null)
  // 音声レベル監視用のAnalyserNode
  const analyserRef = useRef<AnalyserNode | null>(null)
  // 音声レベル監視用のアニメーションフレーム
  const animationFrameRef = useRef<number | null>(null)
  const selectLanguage = settingsStore((s) => s.selectLanguage)

  const { t } = useTranslation()

  // 無音検出用の追加変数
  const lastSpeechTimestamp = useRef<number>(0)
  const silenceCheckInterval = useRef<NodeJS.Timeout | null>(null)
  const speechEndedRef = useRef<boolean>(false)
  const stopListeningRef = useRef<(() => Promise<void>) | null>(null)
  
  // 音声レベルによる無音検出のための変数
  const isSpeakingRef = useRef<boolean>(false)
  const silenceStartTimeRef = useRef<number>(0)
  const audioLevelAboveThresholdRef = useRef<boolean>(false)
  
  // テキスト送信の重複を防ぐフラグ
  const isSubmittingRef = useRef<boolean>(false)
  
  // 関数をuseRefで保持して依存関係の循環を防ぐ
  const startSilenceDetectionRef = useRef<
    ((stopListeningFn: () => Promise<void>) => void) | null
  >(null)
  const clearSilenceDetectionRef = useRef<(() => void) | null>(null)
  const sendAudioBufferRef = useRef<(() => void) | null>(null)

  // 音声停止
  const handleStopSpeaking = useCallback(() => {
    homeStore.setState({ isSpeaking: false })
  }, [])

  // 初期音声検出タイマーをクリアする関数
  const clearInitialSpeechCheckTimer = useCallback(() => {
    if (initialSpeechCheckTimerRef.current) {
      clearTimeout(initialSpeechCheckTimerRef.current)
      initialSpeechCheckTimerRef.current = null
    }
  }, [])

  const checkMicrophonePermission = async (): Promise<boolean> => {
    // Firefoxの場合はエラーメッセージを表示して終了
    if (navigator.userAgent.toLowerCase().includes('firefox')) {
      toastStore.getState().addToast({
        message: t('Toasts.FirefoxNotSupported'),
        type: 'error',
        tag: 'microphone-permission-error-firefox',
      })
      return false
    }

    try {
      // getUserMediaを直接呼び出し、ブラウザのネイティブ許可モーダルを表示
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((track) => track.stop())
      return true
    } catch (error) {
      // ユーザーが明示的に拒否した場合や、その他のエラーの場合
      console.error('Microphone permission error:', error)
      return false
    }
  }

  // getVoiceLanguageCodeをuseCallbackでラップして依存関係を明確にする
  const getVoiceLanguageCode = useCallback(
    (selectLanguage: string): VoiceLanguage => {
      switch (selectLanguage) {
        case 'ja':
          return 'ja-JP'
        case 'en':
          return 'en-US'
        case 'ko':
          return 'ko-KR'
        case 'zh':
          return 'zh-TW'
        case 'vi':
          return 'vi-VN'
        case 'fr':
          return 'fr-FR'
        case 'es':
          return 'es-ES'
        case 'pt':
          return 'pt-PT'
        case 'de':
          return 'de-DE'
        case 'ru':
          return 'ru-RU'
        case 'it':
          return 'it-IT'
        case 'ar':
          return 'ar-SA'
        case 'hi':
          return 'hi-IN'
        case 'pl':
          return 'pl-PL'
        case 'th':
          return 'th-TH'
        default:
          return 'ja-JP'
      }
    },
    []
  )

  // 無音検出をクリーンアップする関数 - 依存がないので先に定義
  const clearSilenceDetection = useCallback(() => {
    if (silenceCheckInterval.current) {
      clearInterval(silenceCheckInterval.current)
      silenceCheckInterval.current = null
    }
  }, [])

  // clearSilenceDetectionをRefに保存
  useEffect(() => {
    clearSilenceDetectionRef.current = clearSilenceDetection
  }, [clearSilenceDetection])

  // プロンプト送信ヘルパー関数 - 二言目以降が送信されない問題の解決
  const sendTranscriptAsPrompt = useCallback((transcript: string) => {
    if (!transcript || transcript.trim() === '') {
      console.log('❌ 送信するテキストが空のため、処理をスキップします');
      return false;
    }
    
    if (isSubmittingRef.current) {
      console.log('⚠️ 既に送信処理中のため、重複送信をスキップします');
      return false;
    }
    
    try {
      isSubmittingRef.current = true;
      console.log(`📤 プロンプト送信を開始します: "${transcript}"`);
      onChatProcessStart(transcript);
      setUserMessage('');
      console.log('✅ プロンプト送信処理が完了しました');
      return true;
    } catch (error) {
      console.error('❌ プロンプト送信中にエラーが発生しました:', error);
      return false;
    } finally {
      // 少し遅延してフラグをリセット（非同期処理の競合を避ける）
      setTimeout(() => {
        isSubmittingRef.current = false;
      }, 300);
    }
  }, [onChatProcessStart]);

  // stopListening関数の先行宣言（実際の実装は下部で行う）
  const stopListening = useCallback(async () => {
    if (stopListeningRef.current) {
      await stopListeningRef.current()
    }
  }, [])

  // 無音検出の繰り返しチェックを行う関数
  const startSilenceDetection = useCallback(
    (stopListeningFn: () => Promise<void>) => {
      // 前回のタイマーがあれば解除
      if (silenceCheckInterval.current) {
        clearInterval(silenceCheckInterval.current)
      }

      // 音声検出時刻を記録
      lastSpeechTimestamp.current = Date.now()
      
      // speechEndedRefを必ずリセット - これが重要
      speechEndedRef.current = false
      console.log(
        '🎤 無音検出を開始しました。無音検出タイムアウトの設定値に基づいて自動送信します。speechEndedRef:', speechEndedRef.current
      )

      // 250ms間隔で無音状態をチェック
      silenceCheckInterval.current = setInterval(() => {
        // 現在時刻と最終音声検出時刻の差を計算
        const silenceDuration = Date.now() - lastSpeechTimestamp.current

        // 無音状態が5秒以上続いた場合は、テキストの有無に関わらず音声認識を停止
        if (silenceDuration >= 5000 && !speechEndedRef.current) {
          console.log(
            `⏱️ ${silenceDuration}ms の長時間無音を検出しました。音声認識を停止します。`
          )
          speechEndedRef.current = true
          
          const trimmedTranscript = transcriptRef.current.trim();
          if (trimmedTranscript) {
            console.log(`📝 長時間無音での認識テキスト: "${trimmedTranscript}"`);
            sendTranscriptAsPrompt(trimmedTranscript);
          }
          
          stopListeningFn()

          // トースト通知を表示
          toastStore.getState().addToast({
            message: t('Toasts.NoSpeechDetected'),
            type: 'info',
            tag: 'no-speech-detected-long-silence',
          })
        }
        // 無音状態が2秒以上続いたかつテキストがある場合は自動送信
        else if (
          settingsStore.getState().noSpeechTimeout > 0 &&
          silenceDuration >= settingsStore.getState().noSpeechTimeout * 1000 &&
          !speechEndedRef.current
        ) {
          const trimmedTranscript = transcriptRef.current.trim()
          console.log(
            `⏱️ ${silenceDuration}ms の無音を検出しました（閾値: ${settingsStore.getState().noSpeechTimeout * 1000}ms）。無音検出タイムアウトが0秒の場合は自動送信は無効です。`
          )
          console.log(`📝 認識テキスト: "${trimmedTranscript}"`)

          if (
            trimmedTranscript &&
            settingsStore.getState().noSpeechTimeout > 0
          ) {
            speechEndedRef.current = true
            console.log('✅ 無音検出による自動送信を実行します')
            // 無音検出で自動送信
            sendTranscriptAsPrompt(trimmedTranscript);
            stopListeningFn()
          }
        }
      }, 250) // 250msごとにチェック
    },
    [sendTranscriptAsPrompt, t]
  )

  // startSilenceDetectionをRefに保存
  useEffect(() => {
    startSilenceDetectionRef.current = startSilenceDetection
  }, [startSilenceDetection])

  // リサンプリング関数
  const resampleAudio = (
    audioData: Float32Array,
    fromSampleRate: number,
    toSampleRate: number
  ): Float32Array => {
    const ratio = fromSampleRate / toSampleRate
    const newLength = Math.round(audioData.length / ratio)
    const result = new Float32Array(newLength)

    for (let i = 0; i < newLength; i++) {
      const position = i * ratio
      const leftIndex = Math.floor(position)
      const rightIndex = Math.ceil(position)
      const fraction = position - leftIndex

      if (rightIndex >= audioData.length) {
        result[i] = audioData[leftIndex]
      } else {
        result[i] =
          (1 - fraction) * audioData[leftIndex] + fraction * audioData[rightIndex]
      }
    }

    return result
  }

  // リサンプリングとモノラル変換を行う関数
  const processAudio = (audioBuffer: AudioBuffer): Float32Array => {
    const targetSampleRate = 24000
    const numChannels = audioBuffer.numberOfChannels

    // モノラルに変換
    let monoData = new Float32Array(audioBuffer.length)
    for (let i = 0; i < audioBuffer.length; i++) {
      let sum = 0
      for (let channel = 0; channel < numChannels; channel++) {
        sum += audioBuffer.getChannelData(channel)[i]
      }
      monoData[i] = sum / numChannels
    }

    // リサンプリング
    return resampleAudio(monoData, audioBuffer.sampleRate, targetSampleRate)
  }

  // Float32Array を PCM16 ArrayBuffer に変換する関数
  const floatTo16BitPCM = (float32Array: Float32Array) => {
    const buffer = new ArrayBuffer(float32Array.length * 2)
    const view = new DataView(buffer)
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]))
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    }
    return buffer
  }

  // Float32Array を base64エンコードされた PCM16 データに変換する関数
  const base64EncodeAudio = (float32Array: Float32Array) => {
    const arrayBuffer = floatTo16BitPCM(float32Array)
    let binary = ''
    const bytes = new Uint8Array(arrayBuffer)
    const chunkSize = 0x8000 // 32KB chunk size
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(
        null,
        Array.from(bytes.subarray(i, i + chunkSize))
      )
    }
    return btoa(binary)
  }

  // sendAudioBuffer関数をここに移動
  const sendAudioBuffer = useCallback(() => {
    if (audioBufferRef.current && audioBufferRef.current.length > 0) {
      const base64Chunk = base64EncodeAudio(audioBufferRef.current)
      const ss = settingsStore.getState()
      const wsManager = webSocketStore.getState().wsManager
      if (wsManager?.websocket?.readyState === WebSocket.OPEN) {
        let sendContent: { type: string; text?: string; audio?: string }[] = []

        if (ss.realtimeAPIModeContentType === 'input_audio') {
          console.log('Sending buffer. Length:', audioBufferRef.current.length)
          sendContent = [
            {
              type: 'input_audio',
              audio: base64Chunk,
            },
          ]
        } else {
          const currentText = transcriptRef.current.trim()
          console.log('Sending text. userMessage:', currentText)
          if (currentText) {
            sendContent = [
              {
                type: 'input_text',
                text: currentText,
              },
            ]
          }
        }

        if (sendContent.length > 0) {
          wsManager.websocket.send(
            JSON.stringify({
              type: 'conversation.item.create',
              item: {
                type: 'message',
                role: 'user',
                content: sendContent,
              },
            })
          )
          wsManager.websocket.send(
            JSON.stringify({
              type: 'response.create',
            })
          )
        }
      }
      audioBufferRef.current = null // 送信後にバッファをクリア
    } else {
      console.error('音声バッファが空です')
    }
  }, [])

  // sendAudioBufferをRefに保存
  useEffect(() => {
    sendAudioBufferRef.current = sendAudioBuffer
  }, [sendAudioBuffer])

  // SpeechRecognitionの状態をリセットするヘルパー関数
  const recreateRecognition = useCallback(() => {
    console.log('🔄 SpeechRecognitionオブジェクトを再作成します');
    
    // VADの状態をリセット - 問題解決の重要ポイント1
    try {
      console.log('🔄 VADの状態をリセットします（recreateRecognition）');
      sileroVad.resetVadState();
    } catch (e) {
      console.error('VADリセットエラー:', e);
    }
    
    // 現在のSpeechRecognitionインスタンスをクリーンアップ
    if (recognition) {
      try {
        recognition.onstart = null;
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.onend = null;
        recognition.onspeechstart = null;
        recognition.onspeechend = null;
        recognition.abort();
      } catch (e) {
        console.log('既存のrecognitionのクリーンアップでエラー:', e);
      }
    }
    
    // 新しいインスタンスを作成
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const newRecognition = new SpeechRecognition();
      newRecognition.lang = getVoiceLanguageCode(selectLanguage);
      newRecognition.continuous = true;
      newRecognition.interimResults = true;

      // 音声認識開始時のハンドラを追加
      newRecognition.onstart = () => {
        console.log('🎙️ Speech recognition started - 新しいセッション');
        // 音声認識開始時刻を記録
        recognitionStartTimeRef.current = Date.now();
        // 音声検出フラグをリセット
        speechDetectedRef.current = false;
        // 必ず送信済みフラグをリセット
        speechEndedRef.current = false;

        // 5秒後に音声が検出されているかチェックするタイマーを設定
        initialSpeechCheckTimerRef.current = setTimeout(() => {
          // 音声が検出されていない場合は音声認識を停止
          if (!speechDetectedRef.current && isListeningRef.current) {
            console.log(
              '⏱️ 5秒間音声が検出されませんでした。音声認識を停止します。'
            );
            stopListening();

            // 必要に応じてトースト通知を表示
            toastStore.getState().addToast({
              message: t('Toasts.NoSpeechDetected'),
              type: 'info',
              tag: 'no-speech-detected',
            });
          }
        }, INITIAL_SPEECH_TIMEOUT);

        // 無音検出を開始
        if (stopListeningRef.current && startSilenceDetectionRef.current) {
          startSilenceDetectionRef.current(stopListeningRef.current);
        }
      };

      // 音声入力検出時のハンドラを追加
      newRecognition.onspeechstart = () => {
        console.log('🗣️ 音声入力を検出しました');
        // 音声検出フラグを立てる
        speechDetectedRef.current = true;
        // 音声検出時刻を更新
        lastSpeechTimestamp.current = Date.now();
      };

      // 結果が返ってきた時のハンドラ（音声検出中）
      newRecognition.onresult = (event) => {
        if (!isListeningRef.current) return;

        // 音声を検出したので、タイムスタンプを更新
        lastSpeechTimestamp.current = Date.now();
        // 音声検出フラグを立てる（結果が返ってきたということは音声が検出されている）
        speechDetectedRef.current = true;

        const transcript = Array.from(event.results)
          .map((result) => result[0].transcript)
          .join('');
        console.log('🔤 認識テキスト更新:', transcript);
        transcriptRef.current = transcript;
        setUserMessage(transcript);
      };

      // 音声入力終了時のハンドラ
      newRecognition.onspeechend = () => {
        console.log('🛑 音声入力が終了しました。無音検出タイマーが動作中です。');
        // 音声入力が終わったが、無音検出はそのまま継続する
        // タイマーが2秒後に処理する
      };

      // 音声認識終了時のハンドラ
      newRecognition.onend = () => {
        console.log('🔚 Recognition ended - セッション終了');
        // 無音検出をクリア
        if (clearSilenceDetectionRef.current) {
          clearSilenceDetectionRef.current();
        }
        // 初期音声検出タイマーをクリア
        clearInitialSpeechCheckTimer();
      };

      newRecognition.onerror = (event) => {
        console.error('🚨 Speech recognition error:', event.error);
        if (clearSilenceDetectionRef.current) {
          clearSilenceDetectionRef.current();
        }
        // 初期音声検出タイマーをクリア
        clearInitialSpeechCheckTimer();
        stopListening();
      };

      setRecognition(newRecognition);
      return newRecognition;
    }
    
    return null;
  }, [selectLanguage, getVoiceLanguageCode, clearInitialSpeechCheckTimer, stopListening, t]);

  // ここで最終的なstopListening実装を行う
  const stopListeningImpl = useCallback(async () => {
    console.log('🛑 stopListeningImpl: 音声認識を停止します。speechEndedRef:', speechEndedRef.current);
    
    // 状態をログ出力
    const currentState = {
      isListening: isListeningRef.current,
      speechDetected: speechDetectedRef.current,
      speechEnded: speechEndedRef.current,
      audioLevelAboveThreshold: audioLevelAboveThresholdRef.current,
      transcript: transcriptRef.current.trim()
    };
    console.log('Current state before stopping:', currentState);
    
    // 無音検出をクリア
    if (clearSilenceDetectionRef.current) {
      clearSilenceDetectionRef.current()
    }

    // 初期音声検出タイマーをクリア
    clearInitialSpeechCheckTimer()

    // 音声認識を停止
    isListeningRef.current = false
    setIsListening(false)
    
    // 音声検出関連の状態をリセット（speechEndedRefはここでリセットしない - 送信処理後にリセット）
    speechDetectedRef.current = false
    audioLevelAboveThresholdRef.current = false
    
    // VADの状態をリセット - 修正点2
    try {
      console.log('🔄 VADの状態をリセットします（stopListeningImpl）');
      sileroVad.resetVadState();
    } catch (e) {
      console.error('VADリセットエラー:', e);
    }
    
    if (recognition) {
      try {
        recognition.stop()
        console.log('✅ recognition.stop()を呼び出しました');
      } catch (error) {
        console.error('❌ Error stopping recognition:', error);
      }

      if (realtimeAPIMode) {
        if (mediaRecorder) {
          mediaRecorder.stop()
          mediaRecorder.ondataavailable = null
          await new Promise<void>((resolve) => {
            mediaRecorder.onstop = async () => {
              console.log('stop MediaRecorder')
              if (audioChunksRef.current.length > 0) {
                const audioBlob = new Blob(audioChunksRef.current, {
                  type: 'audio/webm',
                })
                const arrayBuffer = await audioBlob.arrayBuffer()
                const audioBuffer =
                  await audioContext!.decodeAudioData(arrayBuffer)
                const processedData = processAudio(audioBuffer)

                audioBufferRef.current = processedData
                resolve()
              } else {
                console.error('音声チャンクが空です')
                resolve()
              }
            }
          })
        }
        // sendAudioBufferの代わりにsendAudioBufferRef.currentを使用
        if (sendAudioBufferRef.current) {
          sendAudioBufferRef.current()
        }
      }

      const trimmedTranscriptRef = transcriptRef.current.trim()
      if (isKeyboardTriggered.current) {
        const pressDuration = Date.now() - (keyPressStartTime.current || 0)
        // 押してから1秒以上 かつ 文字が存在する場合のみ送信
        // 無音検出による自動送信が既に行われていない場合のみ送信する
        if (
          pressDuration >= 1000 &&
          trimmedTranscriptRef &&
          !speechEndedRef.current
        ) {
          sendTranscriptAsPrompt(trimmedTranscriptRef);
        }
        isKeyboardTriggered.current = false
      }
    }
    
    // セッション終了処理とテキスト送信後、新しいセッションを準備
    setTimeout(() => {
      console.log('🔄 セッション終了後に音声認識を再初期化します。状態リセット前speechEndedRef:', speechEndedRef.current);
      // 送信処理が完了した後にspeechEndedRefをリセット
      speechEndedRef.current = false;
      
      // 音声認識をリセット
      recreateRecognition();
      
      // トランスクリプトをクリア
      transcriptRef.current = '';
      console.log('✅ 全ての状態をリセットしました。新しいセッションの準備完了。');
    }, 500);
  }, [
    recognition,
    realtimeAPIMode,
    mediaRecorder,
    audioContext,
    sendTranscriptAsPrompt,
    clearInitialSpeechCheckTimer,
    recreateRecognition
  ])

  // stopListeningの実装を上書き
  useEffect(() => {
    stopListeningRef.current = stopListeningImpl
  }, [stopListeningImpl])
  
  // あらかじめstartListeningの定義を行う
  const startListening = useCallback(async () => {
    const hasPermission = await checkMicrophonePermission();
    if (!hasPermission) return;

    // VADの状態を完全にリセット - 修正点3 これが二言目・三言目の問題を解決する
    try {
      console.log('👂 startListening: 音声認識を開始します - VADをリセット');
      sileroVad.resetVadState();
    } catch (error) {
      console.error('VADリセットエラー:', error);
    }
    
    // 新しいSpeechRecognitionオブジェクトを作成
    const currentRecognition = recreateRecognition() || recognition;
    
    if (currentRecognition && !isListeningRef.current && audioContext) {
      transcriptRef.current = '';
      setUserMessage('');
      try {
        console.log('🎬 recognition.start()を呼び出します');
        currentRecognition.start();
        console.log('✅ recognition.start()の呼び出しに成功しました');
      } catch (error) {
        console.error('❌ Error starting recognition:', error);
        // 音声認識の開始に失敗したら、状態をリセットして再試行しない
        return;
      }
      
      isListeningRef.current = true;
      setIsListening(true);

      if (realtimeAPIMode) {
        audioChunksRef.current = []; // 音声チャンクをリセット

        navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
          const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
          setMediaRecorder(recorder);

          recorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
              audioChunksRef.current.push(event.data);
            }
          };

          recorder.start(500);
        });
      }
    }
  }, [
    checkMicrophonePermission,
    recreateRecognition,
    recognition,
    audioContext,
    realtimeAPIMode,
  ]);

  // AlwaysListening設定に応じて自動的に音声認識を開始/停止する
  useEffect(() => {
    console.log('🎧 AlwaysListening設定が変更されました:', alwaysListening);
    
    // 常時音声認識がONで、かつ現在音声認識していない場合は開始
    if (alwaysListening && !isListeningRef.current && !isSpeaking) {
      console.log('🎙️ 常時音声認識設定が有効なため、自動的に音声認識を開始します');
      // 少し遅延させて他の初期化が完了してから開始
      const timer = setTimeout(() => {
        startListening();
      }, 1000);
      
      return () => clearTimeout(timer);
    }
    
    // 常時音声認識がOFFで、現在音声認識中の場合は停止
    if (!alwaysListening && isListeningRef.current && 
        // キーボードトリガーによる手動認識は停止しない
        !isKeyboardTriggered.current) {
      console.log('🛑 常時音声認識設定が無効になったため、音声認識を停止します');
      stopListening();
    }
  }, [alwaysListening, isSpeaking, startListening, stopListening]);

  // 常時音声認識の状態を監視し、必要に応じて再開する
  const lastCheckTimeRef = useRef<number>(Date.now());
  
  // 音声認識の状態を監視し、必要に応じて再起動する
  useEffect(() => {
    // 常時音声認識がONの場合のみ監視処理を実行
    if (!alwaysListening) return;

    console.log('🔍 常時音声認識の状態監視を開始します');
    
    // 定期的に音声認識の状態をチェックして必要に応じて再開する
    const intervalId = setInterval(() => {
      // 音声認識が停止中で、最後のチェックから3秒以上経過している場合は再開を試みる
      const now = Date.now();
      if (!isListeningRef.current && (now - lastCheckTimeRef.current > 3000)) {
        console.log('⚠️ 音声認識が停止していることを検出しました。再開を試みます');
        lastCheckTimeRef.current = now;
        
        // 少し遅延させて他の処理が完了してから再開
        setTimeout(() => {
          console.log('🔄 音声認識を再開します（定期チェック）');
          startListening();
        }, 500);
      }
    }, 5000); // 5秒ごとにチェック
    
    // クリーンアップ関数
    return () => {
      clearInterval(intervalId);
      console.log('🛑 常時音声認識の状態監視を終了します');
    };
  }, [alwaysListening, startListening]);
  
  // AudioContextが初期化されたら音声認識を開始する
  useEffect(() => {
    if (audioContext && alwaysListening && !isListeningRef.current) {
      console.log('🔊 AudioContextが初期化されたため、音声認識を開始します');
      setTimeout(() => {
        startListening();
      }, 1000);
    }
  }, [audioContext, alwaysListening, startListening]);
  
  // バッファリング設定の変更を監視する状態
  const [prevBufferSettings, setPrevBufferSettings] = useState({
    enabled: audioBufferEnabled,
    duration: audioBufferDuration
  });
  
  // 音声バッファリング設定が変更されたことを検出するだけのuseEffect
  useEffect(() => {
    // 設定が前回と異なる場合のみ処理
    if (prevBufferSettings.enabled !== audioBufferEnabled || 
        prevBufferSettings.duration !== audioBufferDuration) {
      
      console.log('🔄 音声バッファリング設定が変更されました:', { 
        audioBufferEnabled, 
        audioBufferDuration 
      });
      
      // バッファをクリア
      audioBufferRef.current = null;
      
      // 現在の設定を保存
      setPrevBufferSettings({
        enabled: audioBufferEnabled,
        duration: audioBufferDuration
      });
      
      // 音声認識のリセットが必要なフラグを立てる
      if (isListeningRef.current) {
        // 安全な方法で音声認識をリセット
        console.log('音声認識のリセットが必要です');
        
        // 既存の停止処理を利用
        stopListening();
        
        // 少し遅延して再開
        setTimeout(() => {
          if (!isListeningRef.current) {
            startListening();
          }
        }, 1000);
      }
    }
  }, [audioBufferEnabled, audioBufferDuration, prevBufferSettings, stopListening, startListening]);

  // ここからUIレンダリング部分
  return (
    <div className="flex items-center w-full">
      <MessageInput
        userMessage={userMessage}
        isMicRecording={isListening}
        isSpeaking={isSpeaking}
        onChangeUserMessage={(event) => {
          if (!isListening) {
            setUserMessage(event.target.value)
          }
        }}
        onClickSendButton={() => {
          if (userMessage === '' || isSpeaking) return;
          
          if (voiceOnlyMode && !isKeyboardTriggered.current && !isListening) {
            console.log(
              'Voice only mode is enabled. Please press and hold the space key to speak.'
            );
            // Show toast notification
            toastStore.getState().addToast({
              message: t('Toasts.VoiceOnlyModeEnabled'),
              type: 'info',
              tag: 'voice-only-mode',
            });
            return;
          }
          
          const text = userMessage;
          setUserMessage('');
          onChatProcessStart(text);
        }}
        onClickMicButton={() => {
          startListening();
        }}
        onClickStopButton={() => {
          stopListening();
        }}
      />
    </div>
  )
}
