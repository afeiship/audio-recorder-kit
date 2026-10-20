# AudioRecorder React Hooks 设计（2026-10-21）

## 目标

为 `@jswork/audio-recorder-kit` 提供 React 绑定层，让 React 应用以细粒度 hooks 方式消费核心 `AudioRecorder`，并以 `file:` 方式在 `aric-notes/audio-recorder-kit-notes` 中落地验证。

## API 形态

子路径导出：`@jswork/audio-recorder-kit/react`（`src/react.tsx` → `dist/react.esm.js` + `dist/react.d.ts`）。

### `AudioRecorderProvider`

- props = `AudioRecorderOptions`（含测试注入通道 `_createRecorder` / `_supportsMediaDevices`）。
- `useRef` 惰性持有唯一 `AudioRecorder` 实例。
- 包装 `start/pause/resume/stop/destroy`：调用后同步镜像 `state`（方法抛错时先镜像 `error` 再抛出）。
- 包装 `onTimeUpdate / onWaveDataUpdate / onError`：更新镜像 `duration / error / vol` 后转发用户回调。
- 组件卸载时自动 `destroy()`。

### `useRecorderState()`

返回：

```ts
{
  state: RecorderState;
  duration: number;
  error: AudioRecorderError | null;
  start(): Promise<void>;
  pause(): void;
  resume(): void;
  stop(options?): Promise<StopResult>;
  destroy(): Promise<void>;
  instance: AudioRecorder;
}
```

错误不吞：方法抛 `AudioRecorderError` 的同时写入 `error` 字段（`useRecorderState` 只读 context，方法包装在 Provider 上）。

### `useWaveform(options?)`

- 默认 `{ state: false }`：只更新 `waveDataRef`/`volRef`（mutable ref，不触发重渲染），组件在 rAF 中读取驱动 canvas。
- `{ state: true }`：额外返回低频 `waveData`/`vol` state（用户显式开启才承担渲染成本）。
- `waveData`：`Uint8Array`，1024 点，值域 0–255（128 为中线），透传核心契约。

### `usePermission()`

```ts
{ status: 'granted' | 'denied' | 'prompt' | 'unknown'; refresh(): Promise<void> }
```

- 挂载时执行 `AudioRecorder.checkPermission()`；SSR / 不支持时为 `unknown`。
- 支持 `navigator.permissions` change 事件监听；无事件源时仅手动 `refresh()`。

## 包结构改动

- `package.json`：新增 `"exports"`（`.` 与 `./react`，各带 `types/import/require`）；`react`/`react-dom` 进 `peerDependencies`（`peerDependenciesMeta` 标注 optional 不需要）。
- `tsup.config.ts`：entry 增加 `src/react.tsx`；react 构建 external（`external: ['react', 'react-dom', 'react/jsx-runtime']`），UMD 不含 react entry（仅核心出 UMD）。

## 测试

- devDeps：`happy-dom`、`@testing-library/react`（bun test 兼容）。
- 沿用 `__tests__/mock.ts` 的 `FakeRecorder` 注入。
- 覆盖：Provider 状态镜像（idle→recording→stopped）、方法错误写入 `error`、卸载销毁、`useWaveform` 默认不重渲染 + `{state:true}` 更新、`usePermission` 流转。

## 示例工程（aric-notes/audio-recorder-kit-notes）

- `pnpm add "file:/Users/afei/github/audio-recorder-kit"`。
- 新增 `src/recorder-demo.tsx`：开始/暂停/继续/停止按钮、rAF 读 `waveDataRef` 绘制 canvas 波形、音量条、停止后展示 `File` 元信息，挂入现有 App。

## 非目标

- 不做 reducer / context selector / SSR 专项处理。
- 不在 hooks 层重复核心状态机守卫（守卫仍由核心类负责）。
