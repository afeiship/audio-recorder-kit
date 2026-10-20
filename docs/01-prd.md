# AudioRecorder 产品需求与技术规格说明书 (PRD)

基于 `js-audio-recorder` 和 `media-devices` 两个库，封装一个通用浏览器录音工具类。

- **项目名称**：`audio-recorder`
- **定位**：无 UI、无业务绑定的通用浏览器录音适配器
- **主要职责**：环境与权限检测、录音状态管理、音频数据与波形输出、资源可靠释放

---

## 1. 职责边界与非目标

### 1.1 职责内
- 浏览器麦克风环境检测与权限显式预检
- 录音生命周期控制（开始 / 暂停 / 继续 / 停止 / 重录 / 销毁）
- 输出标准 wav Blob、File 对象、临时 ObjectURL、累计时长
- 支持指定音频输出参数（采样率、采样位数、声道数），满足 DSR / 语音评测等下游接口对音频格式的严格要求
- 统一节拍输出实时波形信息（音量、时域波形点阵、当前累计时长）
- 时长上限守卫（达到最大时长自动停止录音）
- 资源可靠释放与销毁保护，防止内存与流泄漏
- 抹平底层异常，对外输出强类型错误码

### 1.2 职责外（非目标）
- **绝不包含任何 UI / Canvas 绘制代码**，波形渲染由上层拿到数据后自行实现
- **不绑定任何业务场景**（不处理上传接口、不持久化、不绑定表单）
- **不包含音频回放控件**（底层虽有 play 能力，本类不作包装，回放属于上层业务）
- **不支持选择输入设备**：底层 `js-audio-recorder` 内部写死默认麦克风，本工具类固定使用系统默认输入设备，不提供 `deviceId` 切换能力的假象

---

## 2. 依赖与交付形态

### 2.1 依赖关系
- 运行时依赖：
  - `js-audio-recorder` (v1.0.7+)：负责底层 AudioContext、录音缓冲区、时域数据分析与 wav 编码
  - `media-devices` (v0.5.0+)：负责跨浏览器 `supportsMediaDevices` 环境检测
- 不引入任何前端框架依赖（Vue/React/Angular），纯原生 JS/TS 可用

### 2.2 构建与产物
- 源码语言：TypeScript（严格模式）
- 构建工具：`tsup`
- 产物格式：
  - ESM (`dist/index.esm.js`)
  - CommonJS (`dist/index.cjs.js`)
  - UMD (`dist/index.umd.js`，全局变量名 `AudioRecorder`)
  - 类型定义 (`dist/index.d.ts`)

---

## 3. 状态机模型

```
                  start()                   pause()
        ┌─────────────────────────┐   ┌─────────────────┐
        │                         ▼   │                 ▼
      [idle] ──start()──► [recording] ◄──resume()── [paused]
        ▲                     │                         │
        │                     │ stop()                  │ stop()
        │                     ▼                         ▼
        └───────────────── [stopped] ◄──────────────────┘
                              │
                    start() (开启新一轮)
                              │
                              ▼
                         [recording]

   [任意状态] ──destroy()──► [destroyed] (终态，不可逆)
```

### 3.1 状态定义
- `idle`：已实例化，尚未开始录音
- `recording`：正在采集音频并持续累积时长
- `paused`：录音暂停，麦克风未释放但数据暂停写入，时长冻结
- `stopped`：当前轮次录音已结束，产物已产出；可再次调用 `start()` 开启下一轮全新录音
- `destroyed`：实例已彻底销毁，内部资源全部释放，调用任何录音方法均抛出 `INVALID_STATE`

### 3.2 状态流转与非法调用守卫
| 当前状态 | start() | pause() | resume() | stop() | destroy() |
|---|---|---|---|---|---|
| `idle` | 合法 → `recording` | 抛 `INVALID_STATE` | 抛 `INVALID_STATE` | 抛 `INVALID_STATE` | 合法 → `destroyed` |
| `recording` | 抛 `INVALID_STATE` | 合法 → `paused` | 抛 `INVALID_STATE` | 合法 → `stopped` | 合法 → `destroyed` |
| `paused` | 抛 `INVALID_STATE` | 抛 `INVALID_STATE` | 合法 → `recording` | 合法 → `stopped` | 合法 → `destroyed` |
| `stopped` | 合法 → `recording` (新一轮) | 抛 `INVALID_STATE` | 抛 `INVALID_STATE` | 抛 `INVALID_STATE` | 合法 → `destroyed` |
| `destroyed` | 抛 `INVALID_STATE` | 抛 `INVALID_STATE` | 抛 `INVALID_STATE` | 抛 `INVALID_STATE` | 幂等直接 resolve |

---

## 4. API 规格定义

### 4.1 类型契约

```ts
export type RecorderState = 'idle' | 'recording' | 'paused' | 'stopped' | 'destroyed';

export type ErrorCode =
  | 'NOT_SUPPORTED'          // 浏览器不支持录音或 mediaDevices API
  | 'NO_DEVICE'              // 未检测到可用的麦克风输入设备
  | 'PERMISSION_DENIED'      // 用户拒绝了麦克风授权
  | 'INVALID_STATE'          // 当前状态下不允许该操作
  | 'NOT_INITIALIZED'        // 底层录音实例未初始化
  | 'MAX_DURATION_INVALID'   // maxDuration 参数非法（<=0 或非有限数）
  | 'UNKNOWN';               // 未知或底层非标准错误

export interface WavePayload {
  vol: number;               // 音量大小，范围 0 ~ 100
  waveData: Uint8Array;      // 时域波形点阵，透传底层 analyser 的时域数据（frequencyBinCount = fftSize/2 = 1024 点），值域 0 ~ 255（128 为中线）
  duration: number;          // 当前累计录音时长（毫秒）
}

export interface StopOptions {
  filename?: string;         // 自定义生成 File 的文件名，缺省按 record_${Date.now()}.wav 命名
}

export interface StopResult {
  blob: Blob;                // 标准 audio/wav 格式的音频二进制
  file: File;                // 标准 File 对象，方便直接组织 FormData 上传 DSR / 评测服务
  url: string;               // 通过 URL.createObjectURL 生成的本地临时访问地址
  duration: number;          // 本轮录音最终时长（毫秒）
}

export interface AudioRecorderOptions {
  sampleRate?: number;       // 采样率（Hz），常用 16000 | 44100，默认 16000（契合大多数 DSR / 语音评测引擎）
  sampleBits?: 8 | 16;       // 采样位数，8 或 16，默认 16
  numChannels?: 1 | 2;       // 声道数，1 单声道，2 双声道，默认 1
  maxDuration?: number;      // 最大录音时长（毫秒），缺省或未传表示不限制
  onTimeUpdate?: (duration: number) => void;
  onWaveDataUpdate?: (payload: WavePayload) => void;
  onMaxReach?: () => void;
  onError?: (error: AudioRecorderError) => void;
}
```

### 4.2 错误类规格

```ts
export class AudioRecorderError extends Error {
  readonly code: ErrorCode;
  readonly rawError?: unknown;

  constructor(code: ErrorCode, message: string, rawError?: unknown);
}
```

### 4.3 核心类签名

```ts
export default class AudioRecorder {
  // 静态检测能力
  static isSupported(): boolean;
  static checkPermission(): Promise<'granted' | 'denied' | 'prompt'>;

  // 构造
  constructor(options?: AudioRecorderOptions);

  // 状态与属性只读访问
  get state(): RecorderState;
  get duration(): number;

  // 生命周期方法
  start(): Promise<void>;
  pause(): void;
  resume(): void;
  stop(options?: StopOptions): Promise<StopResult>;
  destroy(): Promise<void>;
}
```

---

## 5. 详细行为契约

### 5.1 环境与权限预检
1. **`AudioRecorder.isSupported()`**
   - 依赖 `media-devices.supportsMediaDevices()` 与 `window.AudioContext` / `window.webkitAudioContext` 判定
   - 同步返回 `true` / `false`，不产生副作用，不弹授权框

2. **`AudioRecorder.checkPermission()`**
   - 优先通过 `navigator.permissions.query({ name: 'microphone' as PermissionName })` 读取状态（若浏览器支持）
   - 若返回 `prompt`，可选择试探性调用 `getUserMedia` 获取设备资格，随即便立即关闭音轨以释放麦克风占用
   - 返回 `'granted' | 'denied' | 'prompt'`
   - 遇到不支持环境直接 reject `NOT_SUPPORTED` 错误

### 5.2 录音控制
1. **`start()`**
   - 校验当前状态必须为 `idle` 或 `stopped`
   - 若为 `stopped` 再次调用，自动重置上轮录音累积数据与时长，开启全新轮次
   - 初始化底层 `js-audio-recorder`，挂载数据钩子
   - 调用底层 `start()`。若捕获异常，按 DOMException 名字归一化为 `AudioRecorderError`：
     - `NotAllowedError` / `SecurityError` → `PERMISSION_DENIED`
     - `NotFoundError` / `OverconstrainedError` → `NO_DEVICE`
     - 其他 → `UNKNOWN`
   - 成功后状态迁至 `recording`

2. **`pause()` 与 `resume()`**
   - `pause()`：状态必须为 `recording`，调用后状态切至 `paused`。此时底层停止灌入采样数据，`duration` 停止累加，所有回调完全暂停触发
   - `resume()`：状态必须为 `paused`，调用后状态切回 `recording`，继续在原时长基础上累加，恢复回调触发

3. **`stop(options?: StopOptions)`**
   - 状态必须为 `recording` 或 `paused`（允许暂停状态下直接结束）
   - 调用底层 `stop()`，获取 wav 数据并通过 `getWAVBlob()` 生成 Blob
   - 根据 `options?.filename`（缺省为 `record_${Date.now()}.wav`）将 Blob 转构为标准 `File` 对象（`new File([blob], filename, { type: 'audio/wav' })`），方便直接放进 `FormData` 发送给 DSR 服务
   - 生成 `url = URL.createObjectURL(blob)`
   - 状态迁至 `stopped`，冻结并返回 `{ blob, file, url, duration }`
   - **对象 URL 生命周期约定**：`url` 的所有权即时转移给调用方，上层在业务使用完毕（如已上传或组件卸载）后需自行调用 `URL.revokeObjectURL(url)`，本工具类不隐式长期追踪

### 5.3 数据与回调输出规则
所有回调由底层音频处理节拍统一驱动（无需额外 `setInterval` / `requestAnimationFrame`），节拍周期约 90~100ms：
1. **`onTimeUpdate(duration)`**
   - 仅在 `recording` 状态触发，单位为毫秒（整数），暂停/停止/销毁期间绝不触发
2. **`onWaveDataUpdate(payload)`**
   - 每次节拍读取底层 `vol`（0~100）及 `getRecordAnalyseData()` 拿到的 1024 点时域数据（0~255，透传底层 analyser 的时域数据，frequencyBinCount = fftSize/2 = 1024 点）
   - 仅在 `recording` 状态触发，暂停和停止时立即停止推送，保证波形自然冻结
3. **`onMaxReach()` 与自动停止**
   - 若配置了 `maxDuration`，在每次节拍检查 `duration >= maxDuration`
   - 达到上限时，先触发一次本帧的 `onTimeUpdate` 与 `onWaveDataUpdate`，紧接着触发 `onMaxReach()`，内部立即触发自动 `stop()` 流程
4. **`onError(error)`**
   - 承接录音生命周期中途产生的异步异常（如设备被拔出、音轨非预期 ended）
   - 若上层未传入 `onError`，默认降级为 `console.error` 输出，确保错误可溯源

### 5.4 资源管理与 `destroy()`
`destroy()` 是最高优先级清理动作，支持在任何状态下调用：
1. 若当前正处于 `recording` 或 `paused`，优先执行停止
2. 调用底层 `js-audio-recorder` 的 `destroy()` 方法，停止 MediaStream 所有音轨，关闭并释放 AudioContext
3. 将内部缓存的 duration、blob 引用全部置空，将所有传入的 options 回调引用置为 `null`，阻断后续任何可能的异步触发
4. 状态置为 `destroyed`
5. 该方法为异步操作（返回 Promise），确保底层资源彻底解绑

---

## 6. 使用示例 (Vanilla ES Module)

```ts
import AudioRecorder, { AudioRecorderError } from 'audio-recorder';

// 1. 能力检测
if (!AudioRecorder.isSupported()) {
  alert('当前浏览器不支持录音功能');
}

// 2. 实例化并绑定回调
const recorder = new AudioRecorder({
  sampleRate: 16000,      // 16kHz 满足 DSR 评测引擎标准输入
  sampleBits: 16,         // 16bit
  numChannels: 1,         // 单声道
  maxDuration: 60 * 1000, // 限制最长 60 秒
  onTimeUpdate(duration) {
    console.log(`当前录制时长: ${(duration / 1000).toFixed(1)}s`);
  },
  onWaveDataUpdate({ vol, waveData, duration }) {
    // waveData 为 Uint8Array(1024)，用于驱动上层 Canvas / WebGL 渲染
    // vol 为 0 ~ 100 的音量，用于绘制音量指示条
    renderWaveform(waveData, vol);
  },
  onMaxReach() {
    console.warn('已达最大录制时长，正在自动保存...');
  },
  onError(err) {
    console.error(`录音过程发生错误 [${err.code}]:`, err.message);
  },
});

// 3. 录音流程控制与 DSR 评测对接
async function handleStart() {
  try {
    await recorder.start();
    console.log('录音已开始');
  } catch (err) {
    if (err instanceof AudioRecorderError) {
      if (err.code === 'PERMISSION_DENIED') {
        alert('请在浏览器设置中允许使用麦克风');
      } else if (err.code === 'NO_DEVICE') {
        alert('未找到可用麦克风设备');
      }
    }
  }
}

function handlePause() {
  recorder.pause();
}

function handleResume() {
  recorder.resume();
}

async function handleStop() {
  // 可传入自定义文件名，方便与题库/业务 ID 关联
  const { blob, file, url, duration } = await recorder.stop({ filename: 'question_01.wav' });
  console.log('录音完成:', { size: blob.size, duration, fileName: file.name });

  // 场景 A：组织 FormData 上传 DSR 评测服务
  const formData = new FormData();
  formData.append('audio', file);
  formData.append('text', 'Hello world');
  // await fetch('/api/dsr/evaluate', { method: 'POST', body: formData });

  // 场景 B：本地试听回放
  const audio = new Audio(url);
  audio.play();

  // 上层适时释放临时地址
  audio.onended = () => URL.revokeObjectURL(url);
}

async function handleClean() {
  await recorder.destroy();
  console.log('录音器已彻底销毁');
}
```

---

## 7. 质量与验收标准

1. **单测覆盖（Mock）**：
   - 覆盖全部合法与非法状态转移断言
   - 覆盖超时自动停止与 `onMaxReach` 时序
   - 覆盖各 DOMException 到 `AudioRecorderError` 的映射
   - 覆盖 `destroy()` 后所有公开方法均抛出 `INVALID_STATE`
2. **构建验证**：
   - `pnpm run build` 成功输出 ESM / CJS / UMD 及完整 d.ts，无 TS 编译告警
3. **手动真机体验验收**：
   - 提供 `demo/index.html` 原生页面，配合简单 Canvas 验证波形连贯性、暂停冻结、恢复续连与超时自动结束
