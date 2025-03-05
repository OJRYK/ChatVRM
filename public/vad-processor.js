// AudioWorkletProcessor for Silero VAD
class VADProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.frameSize = options.processorOptions.frameSize || 512;
    this.sampleRate = options.processorOptions.sampleRate || 16000;
    this.buffer = new Float32Array(this.frameSize);
    this.bufferIndex = 0;
  }

  process(inputs, outputs) {
    // 最初の入力チャンネルを取得
    const input = inputs[0];
    if (!input || !input.length) return true;
    
    // モノラルチャンネルを使用（複数チャンネルある場合は最初のみ）
    const channel = input[0];
    
    // バッファにサンプルを追加
    for (let i = 0; i < channel.length; i++) {
      this.buffer[this.bufferIndex++] = channel[i];
      
      // バッファがいっぱいになったら処理
      if (this.bufferIndex >= this.frameSize) {
        // フレームをメインスレッドに送信
        this.port.postMessage({
          type: 'frame',
          frame: this.buffer.slice()
        });
        
        // バッファをリセット
        this.bufferIndex = 0;
      }
    }
    
    // 処理を継続
    return true;
  }
}

// AudioWorkletProcessorを登録
registerProcessor('vad-processor', VADProcessor);
