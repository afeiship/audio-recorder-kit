// Ambient override for js-audio-recorder, whose shipped types are loose.
// This block intentionally narrows them for stricter local type-checking.
declare module 'js-audio-recorder' {
  export interface RecorderConfig {
    sampleBits?: number;
    sampleRate?: number;
    numChannels?: number;
    compiling?: boolean;
  }

  export interface ProgressPayload {
    duration: number;
    fileSize: number;
    vol: number;
    // Raw per-sample frames; upstream never actually passes this at runtime,
    // so it is optional. Unit: DataView of 32-bit float samples per channel.
    data?: Array<DataView>;
  }

  export default class Recorder {
    duration: number;
    fileSize: number;
    onprogress: (payload: ProgressPayload) => void;
    onprocess: (duration: number) => void;
    constructor(options?: RecorderConfig);
    start(): Promise<void>;
    pause(): void;
    resume(): void;
    stop(): void;
    destroy(): Promise<void>;
    getRecordAnalyseData(): Uint8Array;
    getWAVBlob(): Blob;
  }
}
