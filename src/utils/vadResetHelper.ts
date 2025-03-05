// SileroVADの状態をリセットするヘルパーユーティリティ
import * as sileroVad from './sileroVad';

/**
 * Silero VADの状態を完全にリセットする関数
 * 音声認識の各セッション間で呼び出すことで、二言目以降の音声認識問題を解決する
 */
export function resetVadState(): void {
  try {
    console.log('🔄 Silero VADの状態をリセットします');
    sileroVad.resetVadState();
    console.log('✅ VADの状態リセット完了');
  } catch (e) {
    console.error('❌ VADリセットエラー:', e);
  }
}
