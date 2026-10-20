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
    data: Array<DataView>;
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

declare module 'media-devices' {
  export function supportsMediaDevices(): boolean;
  export function enumerateDevices(): Promise<MediaDeviceInfo[]>;
  export function getUserMedia(constraints?: MediaStreamConstraints): Promise<MediaStream>;
}
