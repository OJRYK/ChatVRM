// sileroVad.tsからresetVadState()を呼び出し、VADの状態をリセットする
import * as sileroVad from './sileroVad';

// 音声認識の各セッション間でVADの状態をリセットするヘルパー関数
export function resetSileroVadCompletely() {
  console.log('🧹 Silero VADの状態を完全にリセットします');
  
  // 既存のresetVadState関数を呼び出す
  sileroVad.resetVadState();
  
  // 追加のログ記録
  console.log('✅ VADの状態リセット完了');
  
  return true;
}
