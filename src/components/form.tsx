import { useCallback, useEffect, useState } from 'react'
import settingsStore from '@/features/stores/settings'
import homeStore from '@/features/stores/home'
import menuStore from '@/features/stores/menu'
import slideStore from '@/features/stores/slide'
import { handleSendChatFn } from '../features/chat/handlers'
import { MessageInputContainer } from './messageInputContainer'
import { SlideText } from './slideText'

export const Form = () => {
  const modalImage = homeStore((s) => s.modalImage)
  const webcamStatus = homeStore((s) => s.webcamStatus)
  const captureStatus = homeStore((s) => s.captureStatus)
  const slideMode = settingsStore((s) => s.slideMode)
  const slideVisible = menuStore((s) => s.slideVisible)
  const slidePlaying = slideStore((s) => s.isPlaying)
  const chatProcessingCount = homeStore((s) => s.chatProcessingCount)
  const [delayedText, setDelayedText] = useState('')
  const handleSendChat = handleSendChatFn()

  useEffect(() => {
    // テキストと画像がそろったら、チャットを送信
    if (delayedText && modalImage) {
      handleSendChat(delayedText)
      setDelayedText('')
    }
  }, [modalImage, delayedText, handleSendChat])

  const hookSendChat = useCallback(
    (text: string) => {
      // 現在の発話があれば中断する
      import('@/features/messages/speakCharacter').then(({ speakQueue }) => {
        speakQueue.interruptSpeaking();
        console.log('🛑 新しいメッセージ入力により発話を中断しました');
      });
      
      // isSpeakingフラグをリセット
      homeStore.setState({ isSpeaking: false });
      
      // すでにmodalImageが存在する場合は、Webcamのキャプチャーをスキップ
      if (!homeStore.getState().modalImage) {
        homeStore.setState({ triggerShutter: true })
      }

      // MENUの中でshowCameraがtrueの場合、画像が取得されるまで待機
      if (webcamStatus || captureStatus) {
        // Webcamが開いている場合
        setDelayedText(text) // 画像が取得されるまで遅延させる
      } else {
        handleSendChat(text)
      }
    },
    [handleSendChat, webcamStatus, captureStatus, setDelayedText]
  )

  return slideMode &&
    slideVisible &&
    (slidePlaying || chatProcessingCount !== 0) ? (
    <SlideText />
  ) : (
    <MessageInputContainer onChatProcessStart={hookSendChat} />
  )
}
