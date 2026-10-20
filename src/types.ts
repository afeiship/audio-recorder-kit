export type RecorderState = 'idle' | 'recording' | 'paused' | 'stopped' | 'destroyed';

export type ErrorCode =
  | 'NOT_SUPPORTED'
  | 'NO_DEVICE'
  | 'PERMISSION_DENIED'
  | 'INVALID_STATE'
  | 'NOT_INITIALIZED'
  | 'MAX_DURATION_INVALID'
  | 'UNKNOWN';

export interface WavePayload {
  vol: number;
  waveData: Uint8Array;
  duration: number;
}

export interface StopOptions {
  filename?: string;
}

export interface StopResult {
  blob: Blob;
  file: File;
  url: string;
  duration: number;
}

export interface AudioRecorderOptions {
  sampleRate?: number;
  sampleBits?: 8 | 16;
  numChannels?: 1 | 2;
  maxDuration?: number;
  onTimeUpdate?: (duration: number) => void;
  onWaveDataUpdate?: (payload: WavePayload) => void;
  onMaxReach?: () => void;
  onError?: (error: any) => void;
}
