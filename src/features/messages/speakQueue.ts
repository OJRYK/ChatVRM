import { Talk } from './messages'
import homeStore from '@/features/stores/home'
import settingsStore from '@/features/stores/settings'
import { Live2DHandler } from './live2dHandler'

type SpeakTask = {
  audioBuffer: ArrayBuffer
  talk: Talk
  isNeedDecode: boolean
  onComplete?: () => void
}

export class SpeakQueue {
  private static readonly QUEUE_CHECK_DELAY = 1500
  private queue: SpeakTask[] = []
  private isProcessing = false
  private currentSessionId: string | null = null
  // 現在発話中のモデルへの参照
  private currentSpeakingModel: any = null

  async addTask(task: SpeakTask) {
    this.queue.push(task)
    await this.processQueue()
  }

  // 発話を中断する関数
  interruptSpeaking() {
    console.log('🔇 発話を中断します');
    
    // 現在発話中のVRMモデルの停止
    const hs = homeStore.getState();
    const ss = settingsStore.getState();
    
    if (ss.modelType === 'vrm' && hs.viewer.model) {
      try {
        hs.viewer.model.interruptSpeaking();
      } catch (e) {
        console.error('VRMモデルの発話中断処理でエラーが発生しました:', e);
      }
    } else if (ss.modelType === 'live2d') {
      try {
        // Live2Dモデルの発話を停止
        import('./live2dHandler').then(({ Live2DHandler }) => {
          Live2DHandler.interruptSpeaking();
        });
      } catch (e) {
        console.error('Live2Dモデルの発話中断処理でエラーが発生しました:', e);
      }
    }
    
    // キューを空にして処理中のフラグをリセット
    this.clearQueue();
    this.isProcessing = false;
    
    // 発話状態をリセット
    homeStore.setState({ isSpeaking: false });
  }

  private async processQueue() {
    if (this.isProcessing) return

    this.isProcessing = true
    const hs = homeStore.getState()
    const ss = settingsStore.getState()

    while (this.queue.length > 0 && hs.isSpeaking) {
      const currentState = homeStore.getState()
      if (!currentState.isSpeaking) {
        this.clearQueue()
        homeStore.setState({ isSpeaking: false })
        break
      }

      const task = this.queue.shift()
      if (task) {
        try {
          const { audioBuffer, talk, isNeedDecode, onComplete } = task
          if (ss.modelType === 'live2d') {
            await Live2DHandler.speak(audioBuffer, talk, isNeedDecode)
          } else {
            await hs.viewer.model?.speak(audioBuffer, talk, isNeedDecode)
          }
          onComplete?.()
        } catch (error) {
          console.error(
            'An error occurred while processing the speech synthesis task:',
            error
          )
          if (error instanceof Error) {
            console.error('Error details:', error.message)
          }
        }
      }
    }

    this.isProcessing = false
    this.scheduleNeutralExpression()
    if (!hs.chatProcessing) {
      this.clearQueue()
    }
  }

  private async scheduleNeutralExpression() {
    const initialLength = this.queue.length
    await new Promise((resolve) =>
      setTimeout(resolve, SpeakQueue.QUEUE_CHECK_DELAY)
    )

    if (this.shouldResetToNeutral(initialLength)) {
      const hs = homeStore.getState()
      const ss = settingsStore.getState()
      if (ss.modelType === 'live2d') {
        await Live2DHandler.resetToIdle()
      } else {
        await hs.viewer.model?.playEmotion('neutral')
      }
    }
  }

  private shouldResetToNeutral(initialLength: number): boolean {
    return initialLength === 0 && this.queue.length === 0 && !this.isProcessing
  }

  clearQueue() {
    this.queue = []
  }

  checkSessionId(sessionId: string) {
    if (this.currentSessionId !== sessionId) {
      this.currentSessionId = sessionId
      this.clearQueue()
      homeStore.setState({ isSpeaking: true })
    }
  }
}
