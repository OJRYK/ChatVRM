declare module 'onnxruntime-web' {
  export class Tensor {
    constructor(type: string, data: Float32Array | Int32Array | Uint8Array, dims: number[]);
    data: Float32Array | Int32Array | Uint8Array;
    dims: number[];
    type: string;
  }

  export namespace InferenceSession {
    export interface SessionOptions {
      executionProviders?: string[];
      graphOptimizationLevel?: string;
      logSeverityLevel?: number;
      logVerbosityLevel?: number;
      executionMode?: string;
      optimizedModelFilePath?: string;
    }

    export interface FeedsType {
      [name: string]: Tensor;
    }

    export interface FetchesType {
      [name: string]: Tensor;
    }

    export interface ReturnType {
      [outputName: string]: Tensor;
    }
  }

  export class InferenceSession {
    static create(
      uri: string | ArrayBuffer | Uint8Array,
      options?: InferenceSession.SessionOptions
    ): Promise<InferenceSession>;

    run(
      feeds: InferenceSession.FeedsType,
      options?: any
    ): Promise<InferenceSession.ReturnType>;
  }
}
