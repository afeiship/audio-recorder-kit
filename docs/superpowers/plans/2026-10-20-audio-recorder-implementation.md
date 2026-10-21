# AudioRecorder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 基于 `js-audio-recorder` 和 `media-devices` 封装无 UI、强类型的浏览器录音工具类 `AudioRecorder`，支持波形输出、DSR 评测文件生成与生命周期资源管理。

**Architecture:** 采用适配器与外观模式（Adapter / Facade），核心类 `AudioRecorder` 组合底层 `js-audio-recorder` 与 `media-devices`，通过依赖注入机制解耦底层浏览器 API，实现无头环境下的严格 TDD 单测；对外暴露状态机守卫、单一音频节拍回调、强类型错误体系及直接可供 DSR 上传的 `File` 产物。

**Tech Stack:** TypeScript (strict), tsup (ESM/CJS/UMD), bun test, js-audio-recorder, media-devices.

---

### File Structure Map

- `package.json`: 依赖项声明（增加 `js-audio-recorder`, `media-devices`）与构建脚本配置
- `src/types.ts`: 全量契约类型定义（状态、配置、回调荷载、返回值、错误码）
- `src/errors.ts`: `AudioRecorderError` 类定义与 DOMException 归一化映射工具
- `src/index.ts`: `AudioRecorder` 核心类实现与默认导出
- `src/shims.d.ts`: `js-audio-recorder` 与 `media-devices` 的 TypeScript 模块类型补充声明
- `__tests__/mock.ts`: 用于单元测试的 Fake Recorder 与 Fake MediaDevices 注入桩
- `__tests__/index.spec.ts`: 覆盖全部状态机流转、回调节拍、DSR 产物与异常映射的自动化单测
- `demo/index.html`: 本地真机测试与波形 Canvas 演示验收页面

---

### Task 1: 初始化依赖与环境类型声明

**Files:**
- Modify: `package.json`
- Create: `src/shims.d.ts`

- [ ] **Step 1: 安装运行时依赖**

使用 `pnpm` 安装 `js-audio-recorder` 和 `media-devices`：

```bash
pnpm add js-audio-recorder media-devices
```

- [ ] **Step 2: 创建第三方库类型声明文件 `src/shims.d.ts`**

```ts
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
```

- [ ] **Step 3: 验证 TypeScript 编译能识别模块**

运行：`pnpm tsc --noEmit`
预期：无找不到模块 `js-audio-recorder` 或 `media-devices` 的报错。

- [ ] **Step 4: 提交**

```bash
git add package.json pnpm-lock.yaml src/shims.d.ts
git commit -m "chore: add js-audio-recorder and media-devices dependencies"
```

---

### Task 2: 定义核心类型契约与错误类 (`types.ts`, `errors.ts`)

**Files:**
- Create: `src/types.ts`
- Create: `src/errors.ts`
- Test: `__tests__/errors.spec.ts`

- [ ] **Step 1: 编写错误类与映射逻辑的失败测试**

创建 `__tests__/errors.spec.ts`：

```ts
import { describe, expect, it } from 'bun:test';
import { AudioRecorderError, mapDOMExceptionToErrorCode } from '../src/errors';

describe('AudioRecorderError', () => {
  it('should create an error with code and message', () => {
    const err = new AudioRecorderError('PERMISSION_DENIED', 'Permission denied');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AudioRecorderError);
    expect(err.code).toBe('PERMISSION_DENIED');
    expect(err.message).toBe('Permission denied');
  });

  it('should map DOMException correctly', () => {
    expect(mapDOMExceptionToErrorCode(new DOMException('', 'NotAllowedError'))).toBe('PERMISSION_DENIED');
    expect(mapDOMExceptionToErrorCode(new DOMException('', 'SecurityError'))).toBe('PERMISSION_DENIED');
    expect(mapDOMExceptionToErrorCode(new DOMException('', 'NotFoundError'))).toBe('NO_DEVICE');
    expect(mapDOMExceptionToErrorCode(new DOMException('', 'OverconstrainedError'))).toBe('NO_DEVICE');
    expect(mapDOMExceptionToErrorCode(new Error('something else'))).toBe('UNKNOWN');
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

运行：`bun test __tests__/errors.spec.ts`
预期：FAIL，找不到 `../src/errors` 模块。

- [ ] **Step 3: 实现 `src/types.ts`**

创建 `src/types.ts`：

```ts
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
```

- [ ] **Step 4: 实现 `src/errors.ts`**

创建 `src/errors.ts`：

```ts
import { ErrorCode } from './types';

export class AudioRecorderError extends Error {
  readonly code: ErrorCode;
  readonly rawError?: unknown;

  constructor(code: ErrorCode, message: string, rawError?: unknown) {
    super(message);
    this.name = 'AudioRecorderError';
    this.code = code;
    this.rawError = rawError;
    Object.setPrototypeOf(this, AudioRecorderError.prototype);
  }
}

export function mapDOMExceptionToErrorCode(err: unknown): ErrorCode {
  if (err && typeof err === 'object' && 'name' in err) {
    const name = (err as { name: string }).name;
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      return 'PERMISSION_DENIED';
    }
    if (name === 'NotFoundError' || name === 'OverconstrainedError') {
      return 'NO_DEVICE';
    }
  }
  return 'UNKNOWN';
}
```

- [ ] **Step 5: 运行测试验证通过**

运行：`bun test __tests__/errors.spec.ts`
预期：PASS（2 个测试全部通过）。

- [ ] **Step 6: 提交**

```bash
git add src/types.ts src/errors.ts __tests__/errors.spec.ts
git commit -m "feat: define core types and AudioRecorderError class"
```

---

### Task 3: 构建可注入 Mock 测试框架 (`__tests__/mock.ts`)

**Files:**
- Create: `__tests__/mock.ts`

- [ ] **Step 1: 编写 Mock 测试桩**

创建 `__tests__/mock.ts`，模拟 `js-audio-recorder` 实例与浏览器 `mediaDevices` 行为，支持手动触发 `emitProgress`、定制模拟音频流和错误抛出：

```ts
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

  shouldThrowOnStart: Error | null = null;
  mockWaveData: Uint8Array = new Uint8Array(2048).fill(128);
  mockBlob: Blob = new Blob(['fake-wav-data'], { type: 'audio/wav' });

  constructor(config: RecorderConfig = {}) {
    this.config = config;
  }

  async start(): Promise<void> {
    if (this.shouldThrowOnStart) {
      throw this.shouldThrowOnStart;
    }
    this.startCalled++;
  }

  pause(): void {
    this.pauseCalled++;
  }

  resume(): void {
    this.resumeCalled++;
  }

  stop(): void {
    this.stopCalled++;
  }

  async destroy(): Promise<void> {
    this.destroyCalled++;
  }

  getRecordAnalyseData(): Uint8Array {
    return this.mockWaveData;
  }

  getWAVBlob(): Blob {
    return this.mockBlob;
  }

  // 辅助测试驱动
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
```

- [ ] **Step 2: 验证 Mock 文件类型无误**

运行：`pnpm tsc --noEmit`
预期：无报错。

- [ ] **Step 3: 提交**

```bash
git add __tests__/mock.ts
git commit -m "test: add FakeRecorder mock for unit testing"
```

---

### Task 4: 实现静态方法与状态机初始化/校验 (`AudioRecorder`)

**Files:**
- Create: `src/index.ts`
- Modify: `__tests__/index.spec.ts`

- [ ] **Step 1: 编写状态机基础与静态检测的失败测试**

修改 `__tests__/index.spec.ts`：

```ts
import { describe, expect, it, beforeEach } from 'bun:test';
import AudioRecorder from '../src/index';
import { FakeRecorder } from './mock';

describe('AudioRecorder - Lifecycle & State Guards', () => {
  it('should initialize in idle state and duration 0', () => {
    const recorder = new AudioRecorder({
      _createRecorder: (cfg) => new FakeRecorder(cfg) as any,
    });
    expect(recorder.state).toBe('idle');
    expect(recorder.duration).toBe(0);
  });

  it('should throw MAX_DURATION_INVALID when maxDuration is invalid', () => {
    expect(() => new AudioRecorder({ maxDuration: -10 })).toThrow();
    expect(() => new AudioRecorder({ maxDuration: 0 })).toThrow();
    expect(() => new AudioRecorder({ maxDuration: NaN })).toThrow();
  });

  it('should throw INVALID_STATE on illegal state transitions', async () => {
    const recorder = new AudioRecorder({
      _createRecorder: (cfg) => new FakeRecorder(cfg) as any,
    });

    expect(() => recorder.pause()).toThrow();
    expect(() => recorder.resume()).toThrow();
    expect(recorder.stop()).rejects.toThrow();
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

运行：`bun test __tests__/index.spec.ts`
预期：FAIL，`src/index.ts` 尚未实现对应属性与检查。

- [ ] **Step 3: 实现基础状态流转与构造守卫**

编写 `src/index.ts` 骨架：

```ts
import Recorder from 'js-audio-recorder';
import { supportsMediaDevices } from 'media-devices';
import { AudioRecorderError, mapDOMExceptionToErrorCode } from './errors';
import {
  AudioRecorderOptions,
  RecorderState,
  StopOptions,
  StopResult,
  WavePayload,
} from './types';

export * from './types';
export * from './errors';

export interface InternalOptions extends AudioRecorderOptions {
  _createRecorder?: (config: any) => Recorder;
  _supportsMediaDevices?: () => boolean;
}

export default class AudioRecorder {
  private _state: RecorderState = 'idle';
  private _duration: number = 0;
  private _recorder: Recorder | null = null;
  private _options: AudioRecorderOptions;
  private _createRecorder: (config: any) => Recorder;
  private _supportsMediaDevices: () => boolean;

  static isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    const hasMedia = supportsMediaDevices();
    const hasAudioContext = !!(window.AudioContext || (window as any).webkitAudioContext);
    return hasMedia && hasAudioContext;
  }

  static async checkPermission(): Promise<'granted' | 'denied' | 'prompt'> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
      throw new AudioRecorderError('NOT_SUPPORTED', 'MediaDevices API not supported');
    }

    if (navigator.permissions && navigator.permissions.query) {
      try {
        const status = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        return status.state;
      } catch {
        // 部分浏览器不支持 query microphone，降级到 try getUserMedia
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

  constructor(options: InternalOptions = {}) {
    if (options.maxDuration !== undefined) {
      if (!Number.isFinite(options.maxDuration) || options.maxDuration <= 0) {
        throw new AudioRecorderError(
          'MAX_DURATION_INVALID',
          `maxDuration must be a positive finite number, got: ${options.maxDuration}`
        );
      }
    }

    this._options = { ...options };
    this._createRecorder = options._createRecorder || ((cfg) => new Recorder(cfg));
    this._supportsMediaDevices =
      options._supportsMediaDevices || (() => AudioRecorder.isSupported());
  }

  get state(): RecorderState {
    return this._state;
  }

  get duration(): number {
    return this._duration;
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
    // 细节由 Task 5 实现
    throw new Error('Not implemented');
  }

  async destroy(): Promise<void> {
    this._state = 'destroyed';
  }
}
```

- [ ] **Step 4: 运行测试验证基础守卫通过**

运行：`bun test __tests__/index.spec.ts`
预期：PASS。

- [ ] **Step 5: 提交**

```bash
git add src/index.ts __tests__/index.spec.ts
git commit -m "feat: implement basic states, validation and static methods"
```

---

### Task 5: 实现录音流程控制、节拍推送与 DSR 结果产出

**Files:**
- Modify: `src/index.ts`
- Modify: `__tests__/index.spec.ts`

- [ ] **Step 1: 编写录音、节拍、超时与 Stop 结果产出的测试**

在 `__tests__/index.spec.ts` 中增加完整测试用例：

```ts
it('should transition from idle -> recording on start()', async () => {
  let fake!: FakeRecorder;
  const recorder = new AudioRecorder({
    _createRecorder: (cfg) => {
      fake = new FakeRecorder(cfg);
      return fake as any;
    },
    _supportsMediaDevices: () => true,
  });

  await recorder.start();
  expect(recorder.state).toBe('recording');
  expect(fake.startCalled).toBe(1);
});

it('should trigger onTimeUpdate and onWaveDataUpdate on fake progress', async () => {
  let fake!: FakeRecorder;
  let timeUpdated = 0;
  let wavePayload: any = null;

  const recorder = new AudioRecorder({
    _createRecorder: (cfg) => {
      fake = new FakeRecorder(cfg);
      return fake as any;
    },
    _supportsMediaDevices: () => true,
    onTimeUpdate: (dur) => {
      timeUpdated = dur;
    },
    onWaveDataUpdate: (p) => {
      wavePayload = p;
    },
  });

  await recorder.start();
  // 模拟底层推进 1.5 秒 (1500ms)
  fake.emitProgress(1.5, 75);

  expect(recorder.duration).toBe(1500);
  expect(timeUpdated).toBe(1500);
  expect(wavePayload).not.toBeNull();
  expect(wavePayload.vol).toBe(75);
  expect(wavePayload.waveData.length).toBe(2048);
  expect(wavePayload.duration).toBe(1500);
});

it('should trigger onMaxReach and auto stop when reaching maxDuration', async () => {
  let fake!: FakeRecorder;
  let maxReached = false;

  const recorder = new AudioRecorder({
    maxDuration: 2000,
    _createRecorder: (cfg) => {
      fake = new FakeRecorder(cfg);
      return fake as any;
    },
    _supportsMediaDevices: () => true,
    onMaxReach: () => {
      maxReached = true;
    },
  });

  await recorder.start();
  // 模拟推进到 2 秒
  fake.emitProgress(2.0, 50);

  expect(maxReached).toBe(true);
  expect(recorder.state).toBe('stopped');
  expect(fake.stopCalled).toBe(1);
});

it('should return blob, file, url, duration in stop() with custom filename', async () => {
  let fake!: FakeRecorder;
  const recorder = new AudioRecorder({
    _createRecorder: (cfg) => {
      fake = new FakeRecorder(cfg);
      return fake as any;
    },
    _supportsMediaDevices: () => true,
  });

  await recorder.start();
  fake.emitProgress(3.5);

  const result = await recorder.stop({ filename: 'question_99.wav' });

  expect(recorder.state).toBe('stopped');
  expect(result.duration).toBe(3500);
  expect(result.blob).toBeDefined();
  expect(result.file).toBeInstanceOf(File);
  expect(result.file.name).toBe('question_99.wav');
  expect(typeof result.url).toBe('string');
});

it('should allow start() again after stopped to record a new session', async () => {
  let fake!: FakeRecorder;
  const recorder = new AudioRecorder({
    _createRecorder: (cfg) => {
      fake = new FakeRecorder(cfg);
      return fake as any;
    },
    _supportsMediaDevices: () => true,
  });

  await recorder.start();
  fake.emitProgress(2);
  await recorder.stop();
  expect(recorder.state).toBe('stopped');

  // 开启新一轮
  await recorder.start();
  expect(recorder.state).toBe('recording');
  expect(recorder.duration).toBe(0);
});
```

- [ ] **Step 2: 运行测试验证失败**

运行：`bun test __tests__/index.spec.ts`
预期：FAIL，`start()` 与 `stop()` 逻辑尚未完成。

- [ ] **Step 3: 完善 `src/index.ts` 中的核心实现**

```ts
import Recorder from 'js-audio-recorder';
import { supportsMediaDevices } from 'media-devices';
import { AudioRecorderError, mapDOMExceptionToErrorCode } from './errors';
import {
  AudioRecorderOptions,
  RecorderState,
  StopOptions,
  StopResult,
  WavePayload,
} from './types';

export * from './types';
export * from './errors';

export interface InternalOptions extends AudioRecorderOptions {
  _createRecorder?: (config: any) => Recorder;
  _supportsMediaDevices?: () => boolean;
}

export default class AudioRecorder {
  private _state: RecorderState = 'idle';
  private _duration: number = 0;
  private _recorder: Recorder | null = null;
  private _options: AudioRecorderOptions;
  private _createRecorder: (config: any) => Recorder;
  private _supportsMediaDevices: () => boolean;
  private _isAutoStopping: boolean = false;

  static isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    const hasMedia = supportsMediaDevices();
    const hasAudioContext = !!(window.AudioContext || (window as any).webkitAudioContext);
    return hasMedia && hasAudioContext;
  }

  static async checkPermission(): Promise<'granted' | 'denied' | 'prompt'> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
      throw new AudioRecorderError('NOT_SUPPORTED', 'MediaDevices API not supported');
    }

    if (navigator.permissions && navigator.permissions.query) {
      try {
        const status = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        return status.state;
      } catch {
        // Fallback to getUserMedia test
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

  constructor(options: InternalOptions = {}) {
    if (options.maxDuration !== undefined) {
      if (!Number.isFinite(options.maxDuration) || options.maxDuration <= 0) {
        throw new AudioRecorderError(
          'MAX_DURATION_INVALID',
          `maxDuration must be a positive finite number, got: ${options.maxDuration}`
        );
      }
    }

    this._options = { ...options };
    this._createRecorder = options._createRecorder || ((cfg) => new Recorder(cfg));
    this._supportsMediaDevices =
      options._supportsMediaDevices || (() => AudioRecorder.isSupported());
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

    // 每次新开启录音，重置时长与驱动实例
    this._duration = 0;
    this._isAutoStopping = false;

    const recorderConfig = {
      sampleRate: this._options.sampleRate ?? 16000,
      sampleBits: this._options.sampleBits ?? 16,
      numChannels: this._options.numChannels ?? 1,
    };

    this._recorder = this._createRecorder(recorderConfig);
    this._attachRecorderHooks(this._recorder);

    try {
      await this._recorder.start();
      this._state = 'recording';
    } catch (err) {
      const code = mapDOMExceptionToErrorCode(err);
      const recorderErr = new AudioRecorderError(code, `Failed to start recorder: ${code}`, err);
      this._options.onError?.(recorderErr);
      throw recorderErr;
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

    let url = '';
    if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      url = URL.createObjectURL(blob);
    }

    return {
      blob,
      file,
      url,
      duration: this._duration,
    };
  }

  async destroy(): Promise<void> {
    if (this._state === 'destroyed') return;

    if (this._state === 'recording' || this._state === 'paused') {
      try {
        this._recorder?.stop();
      } catch {
        // ignore
      }
    }

    if (this._recorder) {
      try {
        await this._recorder.destroy();
      } catch {
        // ignore
      }
      this._recorder = null;
    }

    // 释放所有回调引用，避免后续触发
    this._options = {};
    this._state = 'destroyed';
  }

  private _attachRecorderHooks(recorder: Recorder): void {
    recorder.onprogress = (payload) => {
      if (this._state !== 'recording' || this._isAutoStopping) return;

      // js-audio-recorder 的 payload.duration 单位是秒，换算为毫秒整数
      this._duration = Math.round(payload.duration * 1000);

      this._options.onTimeUpdate?.(this._duration);

      const waveData = recorder.getRecordAnalyseData?.() ?? new Uint8Array(2048).fill(128);
      const wavePayload: WavePayload = {
        vol: Math.min(100, Math.max(0, Math.round(payload.vol || 0))),
        waveData,
        duration: this._duration,
      };
      this._options.onWaveDataUpdate?.(wavePayload);

      // 检查最大时长守卫
      if (this._options.maxDuration && this._duration >= this._options.maxDuration) {
        this._isAutoStopping = true;
        this._options.onMaxReach?.();
        this.stop().catch((err) => {
          this._options.onError?.(err);
        });
      }
    };
  }
}
```

- [ ] **Step 4: 运行所有单测验证通过**

运行：`bun test`
预期：所有测试全部通过（PASS）。

- [ ] **Step 5: 提交**

```bash
git add src/index.ts __tests__/index.spec.ts
git commit -m "feat: complete recording lifecycle, wave dispatching and stop result"
```

---

### Task 6: 编写 `destroy()` 资源清理与异常处理单测

**Files:**
- Modify: `__tests__/index.spec.ts`

- [ ] **Step 1: 编写 destroy 幂等性、资源释放及销毁后阻断测试**

在 `__tests__/index.spec.ts` 中添加测试：

```ts
describe('AudioRecorder - destroy & cleanup', () => {
  it('should call destroy on underlying recorder and clear callbacks', async () => {
    let fake!: FakeRecorder;
    let timeCallbackTriggered = false;

    const recorder = new AudioRecorder({
      _createRecorder: (cfg) => {
        fake = new FakeRecorder(cfg);
        return fake as any;
      },
      _supportsMediaDevices: () => true,
      onTimeUpdate: () => {
        timeCallbackTriggered = true;
      },
    });

    await recorder.start();
    await recorder.destroy();

    expect(recorder.state).toBe('destroyed');
    expect(fake.destroyCalled).toBe(1);

    // 触发 fake 进度，回调不应再被执行
    fake.emitProgress(1);
    expect(timeCallbackTriggered).toBe(false);
  });

  it('should reject all operations after destroyed', async () => {
    const recorder = new AudioRecorder({
      _createRecorder: (cfg) => new FakeRecorder(cfg) as any,
      _supportsMediaDevices: () => true,
    });

    await recorder.destroy();
    expect(recorder.start()).rejects.toThrow();
    expect(() => recorder.pause()).toThrow();
    expect(() => recorder.resume()).toThrow();
    expect(recorder.stop()).rejects.toThrow();
  });
});
```

- [ ] **Step 2: 运行测试验证**

运行：`bun test`
预期：PASS。

- [ ] **Step 3: 提交**

```bash
git add __tests__/index.spec.ts
git commit -m "test: verify destroy cleanup and post-destruction state guards"
```

---

### Task 7: 配置构建与验证产物打包

**Files:**
- Modify: `tsup.config.ts`
- Modify: `package.json`

- [ ] **Step 1: 检查并配置 `tsup.config.ts` UMD global name**

确保 UMD global name 设置为 `AudioRecorder`，并将 `js-audio-recorder` 和 `media-devices` 打包或按需外置。作为一个独立开箱即用的 UMD 库，应当直接打包进去或友好导出：

```ts
import { defineConfig, Options } from 'tsup';
import tsupBanner from '@jswork/tsup-banner';
import { umdWrapper } from 'esbuild-plugin-umd-wrapper';
import { replace } from 'esbuild-plugin-replace';

const baseOptions: Options = {
  entry: ['src/index.ts'],
  clean: true,
  format: ['cjs', 'esm'],
  tsconfig: './tsconfig.json',
  dts: true,
  sourcemap: true,
  cjsInterop: true,
  banner: {
    js: tsupBanner(),
  },
  outExtension({ format }) {
    return {
      js: `.${format}.js`,
    };
  },
};

const umdOptions: Options = {
  entry: ['src/index.ts'],
  clean: false,
  format: ['umd'] as any,
  tsconfig: './tsconfig.json',
  sourcemap: true,
  banner: {
    js: tsupBanner(),
  },
  outExtension({ format }) {
    return {
      js: `.${format}.js`,
    };
  },
  esbuildPlugins: [
    replace({
      'export default': 'export =',
    }),
    umdWrapper({
      libraryName: 'AudioRecorder',
    }),
  ],
};

export default defineConfig([
  {
    ...baseOptions,
    splitting: false,
  },
  umdOptions,
]);
```

- [ ] **Step 2: 执行构建并验证输出产物**

运行：`pnpm run build`
预期：在 `dist/` 目录下生成 `index.esm.js`, `index.cjs.js`, `index.umd.js`, `index.d.ts`，控制台无报错。

- [ ] **Step 3: 提交**

```bash
git add tsup.config.ts
git commit -m "chore: configure tsup build and export AudioRecorder UMD library"
```

---

### Task 8: 编写原生 Demo 验收页面 (`demo/index.html`)

**Files:**
- Create: `demo/index.html`

- [ ] **Step 1: 创建支持波形绘制与 DSR 结果展示的 Demo 页面**

创建 `demo/index.html`，通过 ESM 引入本地产物，提供 Canvas 实时波形绘制、音量指示条、录音开始/暂停/恢复/停止以及生成的 `File` / `Blob` 详细信息看板：

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>AudioRecorder Demo</title>
  <style>
    body { font-family: sans-serif; padding: 24px; max-width: 680px; margin: 0 auto; }
    .box { border: 1px solid #ddd; padding: 16px; border-radius: 8px; margin-bottom: 16px; }
    .btn-group button { margin-right: 8px; padding: 8px 16px; cursor: pointer; }
    canvas { background: #181818; width: 100%; height: 120px; display: block; border-radius: 4px; margin-top: 12px; }
    .vol-meter { height: 10px; background: #eee; border-radius: 5px; overflow: hidden; margin-top: 8px; }
    .vol-bar { height: 100%; background: #4caf50; width: 0%; transition: width 0.05s ease; }
    pre { background: #f5f5f5; padding: 12px; border-radius: 4px; font-size: 13px; }
  </style>
</head>
<body>
  <h2>AudioRecorder 原生演示</h2>
  <div class="box">
    <div class="btn-group">
      <button id="btnStart">开始录音</button>
      <button id="btnPause" disabled>暂停</button>
      <button id="btnResume" disabled>继续</button>
      <button id="btnStop" disabled>停止</button>
      <button id="btnDestroy">销毁</button>
    </div>
    <div style="margin-top: 12px;">
      状态: <strong id="lblState">idle</strong> |
      时长: <strong id="lblDuration">0.0s</strong> / 30s
    </div>
    <div class="vol-meter"><div class="vol-bar" id="volBar"></div></div>
    <canvas id="waveCanvas" width="600" height="120"></canvas>
  </div>

  <div class="box" id="resultBox" style="display: none;">
    <h3>DSR 评测产物 (File & Blob)</h3>
    <pre id="resultInfo"></pre>
    <audio id="audioPlayer" controls style="width: 100%; margin-top: 8px;"></audio>
  </div>

  <script type="module">
    import AudioRecorder from '../dist/index.esm.js';

    const canvas = document.getElementById('waveCanvas');
    const ctx = canvas.getContext('2d');
    const volBar = document.getElementById('volBar');
    const lblState = document.getElementById('lblState');
    const lblDuration = document.getElementById('lblDuration');
    const btnStart = document.getElementById('btnStart');
    const btnPause = document.getElementById('btnPause');
    const btnResume = document.getElementById('btnResume');
    const btnStop = document.getElementById('btnStop');
    const btnDestroy = document.getElementById('btnDestroy');
    const resultBox = document.getElementById('resultBox');
    const resultInfo = document.getElementById('resultInfo');
    const audioPlayer = document.getElementById('audioPlayer');

    function drawWave(waveData) {
      ctx.fillStyle = '#181818';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#00e676';
      ctx.beginPath();
      const sliceWidth = canvas.width / waveData.length;
      let x = 0;
      for (let i = 0; i < waveData.length; i++) {
        const v = waveData[i] / 128.0;
        const y = (v * canvas.height) / 2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }
      ctx.stroke();
    }

    const recorder = new AudioRecorder({
      sampleRate: 16000,
      sampleBits: 16,
      numChannels: 1,
      maxDuration: 30 * 1000,
      onTimeUpdate(dur) {
        lblDuration.innerText = (dur / 1000).toFixed(1) + 's';
      },
      onWaveDataUpdate({ vol, waveData }) {
        volBar.style.width = vol + '%';
        drawWave(waveData);
      },
      onMaxReach() {
        alert('已达 30 秒最大时长，自动停止');
      },
      onError(err) {
        console.error('录音器发生错误:', err);
      }
    });

    function syncState() {
      lblState.innerText = recorder.state;
      btnStart.disabled = recorder.state === 'recording' || recorder.state === 'paused';
      btnPause.disabled = recorder.state !== 'recording';
      btnResume.disabled = recorder.state !== 'paused';
      btnStop.disabled = recorder.state !== 'recording' && recorder.state !== 'paused';
    }

    btnStart.onclick = async () => {
      await recorder.start();
      syncState();
    };
    btnPause.onclick = () => { recorder.pause(); syncState(); };
    btnResume.onclick = () => { recorder.resume(); syncState(); };
    btnStop.onclick = async () => {
      const res = await recorder.stop({ filename: 'dsr_exam_01.wav' });
      syncState();
      resultBox.style.display = 'block';
      resultInfo.innerText = JSON.stringify({
        fileName: res.file.name,
        fileSize: res.file.size + ' bytes',
        fileType: res.file.type,
        duration: res.duration + ' ms',
        blobSize: res.blob.size,
        url: res.url,
      }, null, 2);
      audioPlayer.src = res.url;
    };
    btnDestroy.onclick = async () => {
      await recorder.destroy();
      syncState();
    };
  </script>
</body>
</html>
```

- [ ] **Step 2: 验证 Demo 文件与构建产物配合**

确保构建 `pnpm run build` 最新，用浏览器打开或本地静态服务器预览验证。

- [ ] **Step 3: 提交**

```bash
git add demo/index.html
git commit -m "feat: add native canvas waveform demo page"
```
