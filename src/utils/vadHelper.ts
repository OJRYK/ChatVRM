// VADの状態をリセットするヘルパーファイル
import * as sileroVad from './sileroVad';

// 音声認識の各セッション間でSilero VADの状態をリセットする
export function resetVadBetweenSessions() {
  console.log('🔄 Silero VADの状態を完全にリセットします (セッション間)');
  
  try {
    // スピーチ履歴と状態をクリア
    sileroVad.resetVadState();

    // 状態のリセット完了を確認
    return true;
  } catch (error) {
    console.error('VADリセット中にエラーが発生しました:', error);
    return false;
  }
}

// 音声が認識された後に呼び出して、VADの状態をリセットする
export function cleanupVadState() {
  console.log('🧹 音声認識後のVAD状態をクリーンアップしています');
  
  try {
    // 状態をクリア
    sileroVad.resetVadState();
    return true;
  } catch (error) {
    console.error('VADクリーンアップエラー:', error);
    return false;
  }
}
