import React, { useState } from 'react'
import homeStore from '@/features/stores/home'
import settingsStore from '@/features/stores/settings'

const AudioLevelDisplay = () => {
  const { audioLevel, speechProb, isVadSpeaking, speechStability } = homeStore()
  const { 
    vadSensitivity, 
    useVad, 
    vadSpeechThreshold, 
    vadSilenceThreshold,
    showAudioDebug
  } = settingsStore()
  
  const [isDragging, setIsDragging] = useState(false)
  const [isDraggingVad, setIsDraggingVad] = useState(false)
  
  // 閾値を超えているかどうかを判定
  const isAboveThreshold = audioLevel > vadSensitivity

  // マウスダウン時の処理 (通常の音量閾値用)
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true)
    updateThreshold(e)
  }

  // マウス移動時の処理 (通常の音量閾値用)
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging) {
      updateThreshold(e)
    }
  }

  // マウスアップ時の処理 (通常の音量閾値用)
  const handleMouseUp = () => {
    setIsDragging(false)
  }

  // 閾値を更新 (通常の音量閾値用)
  const updateThreshold = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left // マウス位置のX座標
    const width = rect.width
    const newThreshold = Math.min(Math.max(x / width, 0), 1) // 0〜1の範囲に制限
    settingsStore.setState({ vadSensitivity: newThreshold })
  }

  // マウスダウン時の処理 (VAD閾値用)
  const handleVadMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDraggingVad(true)
    updateVadThreshold(e)
  }

  // マウス移動時の処理 (VAD閾値用)
  const handleVadMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDraggingVad) {
      updateVadThreshold(e)
    }
  }

  // マウスアップ時の処理 (VAD閾値用)
  const handleVadMouseUp = () => {
    setIsDraggingVad(false)
  }

  // VAD閾値を更新
  const updateVadThreshold = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left // マウス位置のX座標
    const width = rect.width
    const newThreshold = Math.min(Math.max(x / width, 0), 1) // 0〜1の範囲に制限
    settingsStore.setState({ vadSpeechThreshold: newThreshold })
  }

  // マウスイベントを登録
  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener('mouseup', handleMouseUp)
      document.addEventListener('mouseleave', handleMouseUp)
    }
    if (isDraggingVad) {
      document.addEventListener('mouseup', handleVadMouseUp)
      document.addEventListener('mouseleave', handleVadMouseUp)
    }
    return () => {
      document.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('mouseleave', handleMouseUp)
      document.removeEventListener('mouseup', handleVadMouseUp)
      document.removeEventListener('mouseleave', handleVadMouseUp)
    }
  }, [isDragging, isDraggingVad])

  // VADの状態に基づいて色を決定
  const getVadBarColor = () => {
    if (isVadSpeaking) {
      // 安定性に基づいて色の強度を変える
      const intensity = Math.floor((0.5 + speechStability / 2) * 255);
      return `rgb(0, ${intensity}, 0)`;
    }
    return 'rgb(0, 100, 200)';
  }
  
  // スイッチトグル
  const toggleVad = () => {
    settingsStore.setState({ useVad: !useVad })
  }

  // デバッグ表示がオフの場合は何も表示しない
  if (!showAudioDebug) return null;
  
  return (
    <div className="fixed bottom-4 left-4 bg-gray-800 bg-opacity-50 text-white p-2 rounded z-50 shadow-lg text-xs" style={{maxWidth: "180px"}}>
      {/* 1行目: モード表示 */}
      <div className="flex justify-between items-center">
        <span className="text-xs">音声:</span>
        <button 
          onClick={toggleVad} 
          className={`px-1 py-0.5 rounded text-[10px] text-black ${useVad ? 'bg-green-600' : 'bg-blue-600'}`}
        >
          {useVad ? 'VAD' : '閾値'}
        </button>
      </div>
      
      {/* 2行目: 音声レベルバー */}
      <div 
        className="w-full h-3 bg-gray-600 rounded relative cursor-pointer my-1"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
      >
        {/* 閾値ライン */}
        <div 
          className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
          style={{ left: `${vadSensitivity * 100}%` }}
        ></div>
        
        {/* 音声レベルバー */}
        <div
          className={`h-3 rounded transition-all duration-75 ${isAboveThreshold ? 'bg-green-500' : 'bg-blue-500'}`}
          style={{ width: `${audioLevel * 100}%` }}
        ></div>
        
        {/* インジケーター数値 */}
        <div className="absolute top-0 right-1 text-[10px] text-white">
          {(audioLevel * 100).toFixed(0)}
        </div>
      </div>
      
      {/* 3行目: VAD情報 (使用時のみ) */}
      {useVad && (
        <div 
          className="w-full h-3 bg-gray-600 rounded relative cursor-pointer"
          onMouseDown={handleVadMouseDown}
          onMouseMove={handleVadMouseMove}
        >
          {/* VAD閾値ライン */}
          <div 
            className="absolute top-0 bottom-0 w-0.5 bg-yellow-500 z-10"
            style={{ left: `${vadSpeechThreshold * 100}%` }}
          ></div>
          
          {/* 発話確率バー */}
          <div
            className="h-3 rounded transition-all duration-75"
            style={{ 
              width: `${speechProb * 100}%`,
              backgroundColor: getVadBarColor()
            }}
          ></div>
          
          {/* 確率値 */}
          <div className="absolute top-0 right-1 text-[10px] text-white">
            {(speechProb * 100).toFixed(0)}
          </div>
        </div>
      )}
    </div>
  )
}

export default AudioLevelDisplay
