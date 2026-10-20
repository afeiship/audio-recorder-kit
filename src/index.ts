import Recorder from 'js-audio-recorder';
import { supportsMediaDevices } from 'media-devices';
import { AudioRecorderError, mapDOMExceptionToErrorCode } from './errors';
import type {
  AudioRecorderOptions,
  RecorderState,
  StopOptions,
  StopResult,
} from './types';

export * from './types';
export * from './errors';

export interface AudioRecorderInternalOptions extends AudioRecorderOptions {
  _createRecorder?: (config: any) => Recorder;
  _supportsMediaDevices?: () => boolean;
}

export default class AudioRecorder {
  private _state: RecorderState = 'idle';
  private _duration: number = 0;
  private _isAutoStopping = false;
  private _recorder: Recorder | null = null;
  private _options: AudioRecorderOptions;
  private _createRecorder: (config: any) => Recorder;
  private _supportsMediaDevices: () => boolean;

  static isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    const hasAudioContext = !!(window.AudioContext || (window as any).webkitAudioContext);
    return supportsMediaDevices() && hasAudioContext;
  }

  static async checkPermission(): Promise<'granted' | 'denied' | 'prompt'> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
      throw new AudioRecorderError('NOT_SUPPORTED', 'MediaDevices API not supported');
    }

    if (navigator.permissions && navigator.permissions.query) {
      try {
        const status = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        return status.state as 'granted' | 'denied' | 'prompt';
      } catch {
        // Some browsers cannot query microphone permission; fall through to getUserMedia probe
      }
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      return 'granted';
    } catch (err) {
      const code = mapDOMExceptionToErrorCode(err);
      if (code === 'PERMISSION_DENIED') return 'denied';
      throw new AudioRecorderError(code, 'Permission check failed', err);
    }
  }

  constructor(options: AudioRecorderInternalOptions = {}) {
    if (options.maxDuration !== undefined) {
      if (!Number.isFinite(options.maxDuration) || options.maxDuration <= 0) {
        throw new AudioRecorderError(
          'MAX_DURATION_INVALID',
          `maxDuration must be a positive finite number, got: ${options.maxDuration}`
        );
      }
    }

    const { _createRecorder, _supportsMediaDevices, ...publicOptions } = options;
    this._options = publicOptions;
    this._createRecorder = _createRecorder || ((cfg) => new Recorder(cfg));
    this._supportsMediaDevices =
      _supportsMediaDevices || (() => AudioRecorder.isSupported());
  }

  get state(): RecorderState {
    return this._state;
  }

  get duration(): number {
    return this._duration;
  }

  async start(): Promise<void> {
    if (this._state !== 'idle' && this._state !== 'stopped') {
      throw new AudioRecorderError('INVALID_STATE', `Cannot start when state is ${this._state}`);
    }
    if (!this._supportsMediaDevices()) {
      throw new AudioRecorderError('NOT_SUPPORTED', 'Recording is not supported in this browser');
    }

    this._duration = 0;
    this._isAutoStopping = false;

    // Free the previous session's AudioContext + MediaStream (upstream stop() alone keeps them alive)
    if (this._recorder) {
      try {
        await this._recorder.destroy();
      } catch {
        // ignore cleanup errors from previous session
      }
      this._recorder = null;
    }

    this._recorder = this._createRecorder({
      sampleRate: this._options.sampleRate ?? 16000,
      sampleBits: this._options.sampleBits ?? 16,
      numChannels: this._options.numChannels ?? 1,
    });
    this._attachRecorderHooks(this._recorder);

    try {
      await this._recorder.start();
      this._state = 'recording';
    } catch (err) {
      this._recorder = null;
      const code = mapDOMExceptionToErrorCode(err);
      const wrapped = new AudioRecorderError(code, `Failed to start recording: ${code}`, err);
      this._options.onError?.(wrapped);
      throw wrapped;
    }
  }

  pause(): void {
    if (this._state !== 'recording') {
      throw new AudioRecorderError('INVALID_STATE', `Cannot pause when state is ${this._state}`);
    }
    this._recorder?.pause();
    this._state = 'paused';
  }

  resume(): void {
    if (this._state !== 'paused') {
      throw new AudioRecorderError('INVALID_STATE', `Cannot resume when state is ${this._state}`);
    }
    this._recorder?.resume();
    this._state = 'recording';
  }

  async stop(options?: StopOptions): Promise<StopResult> {
    if (this._state !== 'recording' && this._state !== 'paused') {
      throw new AudioRecorderError('INVALID_STATE', `Cannot stop when state is ${this._state}`);
    }
    if (!this._recorder) {
      throw new AudioRecorderError('NOT_INITIALIZED', 'Recorder instance not initialized');
    }

    this._recorder.stop();
    this._state = 'stopped';

    const blob = this._recorder.getWAVBlob();
    const filename = options?.filename || `record_${Date.now()}.wav`;
    const file = new File([blob], filename, { type: 'audio/wav' });
    const url =
      typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
        ? URL.createObjectURL(blob)
        : '';

    return { blob, file, url, duration: this._duration };
  }

  async destroy(): Promise<void> {
    if (this._state === 'destroyed') return;
    if (this._recorder) {
      if (this._state === 'recording' || this._state === 'paused') {
        try {
          this._recorder.stop();
        } catch {
          // ignore stop errors during destroy
        }
      }
      try {
        await this._recorder.destroy();
      } catch {
        // ignore cleanup errors
      }
      this._recorder = null;
    }
    this._options = {};
    this._state = 'destroyed';
  }

  private _attachRecorderHooks(recorder: Recorder): void {
    recorder.onprogress = (payload) => {
      if (this._state !== 'recording' || this._isAutoStopping) return;

      // upstream duration is in SECONDS; public contract is milliseconds
      this._duration = Math.round(payload.duration * 1000);
      this._options.onTimeUpdate?.(this._duration);

      const waveData = recorder.getRecordAnalyseData?.() ?? new Uint8Array(1024).fill(128);
      this._options.onWaveDataUpdate?.({
        vol: Math.min(100, Math.max(0, Math.round(payload.vol || 0))),
        waveData,
        duration: this._duration,
      });

      if (this._options.maxDuration && this._duration >= this._options.maxDuration) {
        this._isAutoStopping = true;
        this._options.onMaxReach?.();
        this.stop().catch((err) => {
          this._options.onError?.(err as AudioRecorderError);
        });
      }
    };
  }
}
