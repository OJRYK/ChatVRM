import { Talk } from './messages'
import homeStore from '@/features/stores/home'
import settingsStore from '@/features/stores/settings'

export class Live2DHandler {
  private static idleMotionInterval: NodeJS.Timeout | null = null // インターバルIDを保持
  private static currentAudio: HTMLAudioElement | null = null // 現在再生中のオーディオ

  /**
   * 現在再生中の音声を中断する
   */
  static interruptSpeaking(): void {
    if (Live2DHandler.currentAudio) {
      try {
        console.log('🔇 Live2DHandler: 現在再生中の音声を停止します');
        Live2DHandler.currentAudio.pause();
        Live2DHandler.currentAudio.currentTime = 0;
        Live2DHandler.currentAudio = null;
      } catch (e) {
        console.error('Live2D音声停止処理でエラーが発生しました:', e);
      }
    }
  }

  static async speak(
    audioBuffer: ArrayBuffer,
    talk: Talk,
    isNeedDecode: boolean = true
  ) {
    const hs = homeStore.getState()
    const ss = settingsStore.getState()
    const live2dViewer = hs.live2dViewer
    if (!live2dViewer) return

    let expression: string | undefined
    let motion: string | undefined
    switch (talk.emotion) {
      case 'neutral':
        expression =
          ss.neutralEmotions[
            Math.floor(Math.random() * ss.neutralEmotions.length)
          ]
        motion = ss.neutralMotionGroup
        break
      case 'happy':
        expression =
          ss.happyEmotions[Math.floor(Math.random() * ss.happyEmotions.length)]
        motion = ss.happyMotionGroup
        break
      case 'sad':
        expression =
          ss.sadEmotions[Math.floor(Math.random() * ss.sadEmotions.length)]
        motion = ss.sadMotionGroup
        break
      case 'angry':
        expression =
          ss.angryEmotions[Math.floor(Math.random() * ss.angryEmotions.length)]
        motion = ss.angryMotionGroup
        break
      case 'relaxed':
        expression =
          ss.relaxedEmotions[
            Math.floor(Math.random() * ss.relaxedEmotions.length)
          ]
        motion = ss.relaxedMotionGroup
        break
    }

    // AudioContextの作成
    const audioContext = new AudioContext()
    let decodedAudio: AudioBuffer

    if (isNeedDecode) {
      // 圧縮音声の場合
      decodedAudio = await audioContext.decodeAudioData(audioBuffer)
    } else {
      // PCM16形式の場合
      const pcmData = new Int16Array(audioBuffer)
      const floatData = new Float32Array(pcmData.length)
      for (let i = 0; i < pcmData.length; i++) {
        floatData[i] =
          pcmData[i] < 0 ? pcmData[i] / 32768.0 : pcmData[i] / 32767.0
      }
      decodedAudio = audioContext.createBuffer(1, floatData.length, 24000) // sampleRateは必要に応じて調整
      decodedAudio.getChannelData(0).set(floatData)
    }

    // デコードされた音声データをBlobに変換
    const offlineContext = new OfflineAudioContext(
      decodedAudio.numberOfChannels,
      decodedAudio.length,
      decodedAudio.sampleRate
    )
    const source = offlineContext.createBufferSource()
    source.buffer = decodedAudio
    source.connect(offlineContext.destination)
    source.start()

    const renderedBuffer = await offlineContext.startRendering()
    const audioBlob = await new Blob([this.audioBufferToWav(renderedBuffer)], {
      type: 'audio/wav',
    })
    const audioUrl = URL.createObjectURL(audioBlob)

    // Live2Dモデルの表情を設定
    if (expression) {
      live2dViewer.expression(expression)
    }
    if (motion) {
      Live2DHandler.stopIdleMotion()
      live2dViewer.motion(motion, undefined, 3)
    }

    // 音声再生の完了を待つ
    // live2dViewer.speakでは音声完了を検知できないので、Audioオブジェクトを使用して音声再生完了を検知している
    // Audioオブジェクトの方も再生すると二重に聞こえてしまうので、再生音量を最低限に設定
    // TODO: もっといい方法があればそれに変更する
    await new Promise<void>((resolve) => {
      // 既存の音声を停止
      Live2DHandler.interruptSpeaking();
      
      // 新しい音声を設定
      const audio = new Audio(audioUrl);
      audio.volume = 0.01;
      audio.onended = () => {
        Live2DHandler.currentAudio = null;
        resolve();
        URL.revokeObjectURL(audioUrl);
      };
      
      // 現在のオーディオとして登録
      Live2DHandler.currentAudio = audio;
      
      // 再生開始
      audio.play();
      live2dViewer.speak(audioUrl);
    })
  }

  static async resetToIdle() {
    // インターバルを停止
    Live2DHandler.stopIdleMotion()

    const hs = homeStore.getState()
    const ss = settingsStore.getState()
    const live2dViewer = hs.live2dViewer
    if (!live2dViewer) return

    // Live2Dモデル以外の場合は早期リターン
    if (ss.modelType !== 'live2d') return

    const idleMotion = ss.idleMotionGroup || 'Idle'
    live2dViewer.motion(idleMotion)
    const expression =
      ss.neutralEmotions[Math.floor(Math.random() * ss.neutralEmotions.length)]
    if (expression) {
      live2dViewer.expression(expression)
    }

    // 5秒ごとのアイドルモーション再生を開始
    Live2DHandler.startIdleMotion(idleMotion, live2dViewer)
  }

  // アイドルモーションのインターバル開始
  private static startIdleMotion(idleMotion: string, live2dViewer: any) {
    const ss = settingsStore.getState()
    if (ss.modelType !== 'live2d') return

    this.idleMotionInterval = setInterval(() => {
      const currentSs = settingsStore.getState()
      if (currentSs.modelType !== 'live2d') {
        this.stopIdleMotion()
        return
      }
      live2dViewer.motion(idleMotion)
    }, 5000)
  }

  // アイドルモーションのインターバル停止
  private static stopIdleMotion() {
    if (this.idleMotionInterval) {
      clearInterval(this.idleMotionInterval)
      this.idleMotionInterval = null
    }
  }

  // WAVファイルフォーマットに変換するヘルパー関数
  private static audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
    const numOfChan = buffer.numberOfChannels
    const length = buffer.length * numOfChan * 2
    const buffer2 = new ArrayBuffer(44 + length)
    const view = new DataView(buffer2)
    const channels = []
    let sample
    let offset = 0
    let pos = 0

    // WAVヘッダーの作成
    setUint32(0x46464952) // "RIFF"
    setUint32(36 + length) // file length
    setUint32(0x45564157) // "WAVE"
    setUint32(0x20746d66) // "fmt "
    setUint32(16) // section length
    setUint16(1) // PCM
    setUint16(numOfChan)
    setUint32(buffer.sampleRate)
    setUint32(buffer.sampleRate * 2 * numOfChan) // byte rate
    setUint16(numOfChan * 2) // block align
    setUint16(16) // bits per sample
    setUint32(0x61746164) // "data"
    setUint32(length)

    // チャンネルデータの取得
    for (let i = 0; i < buffer.numberOfChannels; i++) {
      channels.push(buffer.getChannelData(i))
    }

    // インターリーブ
    while (pos < buffer.length) {
      for (let i = 0; i < numOfChan; i++) {
        sample = Math.max(-1, Math.min(1, channels[i][pos]))
        sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0
        view.setInt16(44 + offset, sample, true)
        offset += 2
      }
      pos++
    }

    function setUint16(data: number) {
      view.setUint16(pos, data, true)
      pos += 2
    }

    function setUint32(data: number) {
      view.setUint32(pos, data, true)
      pos += 4
    }

    return buffer2
  }
}
