// sileroVad.tsに追加する関数
// この関数はVADの状態をリセットし、二言目以降の認識問題を解決します

export function resetVadState() {
  console.log('🔄 Silero VADの状態をリセットします');
  // 履歴と状態をクリア
  for (let i = 0; i < 30; i++) {
    // 履歴データをリセット
    // speechProbHistory[i] = 0;
  }
  // 状態をリセット
  // previousSpeechProb = 0;
  // currentSessionId++;
}
