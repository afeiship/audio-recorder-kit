import type { ProgressPayload, RecorderConfig } from 'js-audio-recorder';

export class FakeRecorder {
  config: RecorderConfig;
  duration: number = 0;
  fileSize: number = 0;
  onprogress: ((payload: ProgressPayload) => void) | null = null;
  onprocess: ((duration: number) => void) | null = null;

  startCalled = 0;
  pauseCalled = 0;
  resumeCalled = 0;
  stopCalled = 0;
  destroyCalled = 0;
  calls: string[] = [];

  shouldThrowOnStart: Error | null = null;
  mockWaveData: Uint8Array = new Uint8Array(1024).fill(128);
  mockBlob: Blob = new Blob(['fake-wav-data'], { type: 'audio/wav' });

  constructor(config: RecorderConfig = {}) {
    this.config = config;
  }

  async start(): Promise<void> {
    this.calls.push('start');
    if (this.shouldThrowOnStart) {
      throw this.shouldThrowOnStart;
    }
    this.startCalled++;
  }

  pause(): void {
    this.calls.push('pause');
    this.pauseCalled++;
  }

  resume(): void {
    this.calls.push('resume');
    this.resumeCalled++;
  }

  stop(): void {
    this.calls.push('stop');
    this.stopCalled++;
  }

  async destroy(): Promise<void> {
    this.calls.push('destroy');
    this.destroyCalled++;
  }

  getRecordAnalyseData(): Uint8Array {
    return this.mockWaveData;
  }

  getWAVBlob(): Blob {
    return this.mockBlob;
  }

  emitProgress(durationSeconds: number, vol: number = 50): void {
    this.duration = durationSeconds;
    if (this.onprogress) {
      this.onprogress({
        duration: durationSeconds,
        fileSize: this.fileSize,
        vol,
        data: [],
      });
    }
  }
}
