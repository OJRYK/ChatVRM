import * as onnx from 'onnxruntime-web';

// モデルのパス
const MODEL_PATH = '/models/silero_vad.onnx';

// VADモデルのインスタンス
let vadModel: onnx.InferenceSession | null = null;

// 状態管理用の変数
let previousSpeechProb = 0;
const SPEECH_HISTORY_SIZE = 30; // 約1秒（30フレーム × 30ms）
const speechProbHistory: number[] = Array(SPEECH_HISTORY_SIZE).fill(0);

// セッションID（状態リセット用）
let currentSessionId = 0;

// モデルの初期化
export async function initVadModel(): Promise<onnx.InferenceSession> {
  if (vadModel) return vadModel;

  try {
    console.log('Initializing Silero VAD model...');
    
    // モデルオプションの設定
    const options: onnx.InferenceSession.SessionOptions = {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all'
    };
    
    // モデルのロード
    // サーバーキャッシュの問題を回避するためにタイムスタンプパラメータを追加
    const modelPath = `${MODEL_PATH}?t=${Date.now()}`;
    console.log(`Loading model from: ${modelPath}`);
    
    try {
      vadModel = await onnx.InferenceSession.create(modelPath, options);
      console.log('Silero VAD model loaded successfully');
    } catch (innerError) {
      console.warn('Failed to load model with timestamp, trying original path:', innerError);
      // オリジナルのパスで再試行
      vadModel = await onnx.InferenceSession.create(MODEL_PATH, options);
      console.log('Silero VAD model loaded successfully (original path)');
    }
    
    return vadModel;
  } catch (error) {
    console.error('Error initializing Silero VAD model:', error);
    // エラーをスローするが、アプリケーションのクラッシュは避ける
    console.warn('Continuing without VAD model, will use fallback methods');
    return null as any; // エラーを返す代わりに null を返す
  }
}

// 音声データを16kHzにリサンプリング
export function resampleTo16kHz(audioData: Float32Array, originalSampleRate: number): Float32Array {
  if (originalSampleRate === 16000) return audioData;
  
  const ratio = originalSampleRate / 16000;
  const newLength = Math.round(audioData.length / ratio);
  const result = new Float32Array(newLength);
  
  for (let i = 0; i < newLength; i++) {
    const originalIndex = Math.min(Math.floor(i * ratio), audioData.length - 1);
    result[i] = audioData[originalIndex];
  }
  
  return result;
}

// 音声フレームの正規化
function normalizeFrame(frame: Float32Array): Float32Array {
  const max = Math.max(...frame.map(Math.abs));
  if (max === 0) return frame;
  
  return frame.map(x => x / max);
}

// フレームをテンソルに変換
function frameToTensor(frame: Float32Array): onnx.Tensor {
  return new onnx.Tensor('float32', frame, [1, frame.length]);
}

// 音声検出の確率を計算
export async function detectSpeechProb(
  audioData: Float32Array,
  sampleRate: number = 48000
): Promise<number> {
  if (!vadModel) {
    try {
      await initVadModel();
    } catch (error) {
      console.error('Failed to initialize VAD model:', error);
      return 0;
    }
  }
  
  try {
    // 16kHzにリサンプリング
    const resampledData = resampleTo16kHz(audioData, sampleRate);
    
    // フレームの正規化
    const normalizedFrame = normalizeFrame(resampledData);
    
    // 入力テンソルの作成
    const inputTensor = frameToTensor(normalizedFrame);
    
    // モデル推論の実行
    const feeds: Record<string, onnx.Tensor> = { input: inputTensor };
    const results = await vadModel!.run(feeds);
    
    // 結果の取得（発話確率）
    const outputData = results.output.data as Float32Array;
    const speechProb = outputData[0];
    
    // 履歴更新
    speechProbHistory.shift();
    speechProbHistory.push(speechProb);
    
    // 平滑化された確率を返す
    const smoothedProb = smoothProbability(speechProb);
    previousSpeechProb = smoothedProb;
    
    return smoothedProb;
  } catch (error) {
    console.error('Error during speech detection:', error);
    return previousSpeechProb;
  }
}

// 確率の平滑化
function smoothProbability(currentProb: number): number {
  // 指数移動平均を使用した平滑化
  const alpha = 0.3; // 平滑化係数（0.0-1.0）
  return alpha * currentProb + (1 - alpha) * previousSpeechProb;
}

// 平均音声確率の計算
export function getAverageSpeechProb(): number {
  return speechProbHistory.reduce((sum, prob) => sum + prob, 0) / SPEECH_HISTORY_SIZE;
}

// 音声状態の判定（話している/話していない）
export function isSpeaking(
  currentProb: number, 
  speechThreshold: number = 0.5, 
  silenceThreshold: number = 0.3
): boolean {
  // ヒステリシスしきい値を使用
  if (previousSpeechProb >= speechThreshold) {
    return currentProb >= silenceThreshold; // 既に話している場合は、より低いしきい値を使用
  } else {
    return currentProb >= speechThreshold; // 話していない場合は、高いしきい値を要求
  }
}

// VADの状態をリセットする関数
export function resetVadState(): void {
  console.log('🔄 VADの状態をリセットします');
  previousSpeechProb = 0;
  for (let i = 0; i < SPEECH_HISTORY_SIZE; i++) {
    speechProbHistory[i] = 0;
  }
  currentSessionId++;
  console.log(`🆔 新しいVADセッションID: ${currentSessionId}`);
}

// 発話の安定性を評価
export function getSpeechStability(): number {
  const recentHistory = speechProbHistory.slice(-10);
  const mean = recentHistory.reduce((sum, val) => sum + val, 0) / recentHistory.length;
  
  // 分散の計算
  const variance = recentHistory.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / recentHistory.length;
  
  // 安定性スコア（0-1、1が最も安定）
  return Math.max(0, 1 - Math.sqrt(variance) * 2);
}
