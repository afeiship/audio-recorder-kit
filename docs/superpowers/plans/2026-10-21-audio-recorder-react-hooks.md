# AudioRecorder React Hooks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 `@jswork/audio-recorder-kit` 增加子路径导出 `./react`（`AudioRecorderProvider` + `useRecorderState` / `useWaveform` / `usePermission`），并在 `aric-notes/audio-recorder-kit-notes` 以 `file:` 安装落地一个示例页。

**Architecture:** Provider 用 `useRef` 惰性持有唯一 `AudioRecorder` 实例并包装其方法与回调，把命令式状态机镜像为 React state；波形默认走 mutable ref（零重渲染），`{ state: true }` 时经内部订阅器升级为 state；权限 hook 独立于 context。

**Tech Stack:** TypeScript (strict), React 18 (peer), tsup 多 entry, bun test + happy-dom + @testing-library/react, Vite (示例工程)。

**Spec:** `docs/superpowers/specs/2026-10-21-audio-recorder-react-hooks-design.md`

---

### File Structure Map

- `bunfig.toml`: bun test 预加载 happy-dom 环境
- `__tests__/happy-dom-setup.ts`: DOM 全局注册 + React act 环境标记
- `__tests__/react.spec.tsx`: hooks 全量单测（沿用 `__tests__/mock.ts` 的 FakeRecorder）
- `src/react.tsx`: React 绑定层（Provider + 3 hooks），子路径入口
- `tsconfig.json`: 增加 `"jsx": "react-jsx"`
- `tsup.config.ts`: 双 entry + react external
- `package.json`: `exports` 子路径映射 + `peerDependencies`
- （外部工程）`aric-notes/audio-recorder-kit-notes/src/recorder-demo.tsx`: 示例页

---

### Task 1: React 测试环境准备

**Files:**
- Modify: `package.json`（devDependencies）
- Create: `bunfig.toml`
- Create: `__tests__/happy-dom-setup.ts`
- Modify: `tsconfig.json`

- [ ] **Step 1: 安装 dev 依赖**

```bash
pnpm add -D react@^18.3.1 react-dom@^18.3.1 @types/react@^18 @types/react-dom@^18 @testing-library/react@^16 happy-dom
```

- [ ] **Step 2: 创建 `bunfig.toml`**

```toml
[test]
preload = ["./__tests__/happy-dom-setup.ts"]
```

- [ ] **Step 3: 创建 `__tests__/happy-dom-setup.ts`**

```ts
import { GlobalRegistrator } from '@happy-dom/global-registrator';

GlobalRegistrator.register();
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
```

- [ ] **Step 4: `tsconfig.json` 的 `compilerOptions` 增加 jsx 编译选项**

在 `"forceConsistentCasingInFileNames": true,` 之后加入：

```json
    "jsx": "react-jsx",
```

- [ ] **Step 5: 验证环境冒烟**

创建临时最小校验：`bun test __tests__/errors.spec.ts` 仍 PASS（preload 生效且不破坏既有测试），`pnpm tsc --noEmit` 无报错。

- [ ] **Step 6: 提交**

```bash
git add package.json pnpm-lock.yaml bunfig.toml __tests__/happy-dom-setup.ts tsconfig.json
git commit -m "chore: set up react test environment with happy-dom"
```

---

### Task 2: 实现 `AudioRecorderProvider` 与 `useRecorderState`

**Files:**
- Create: `src/react.tsx`
- Test: `__tests__/react.spec.tsx`

- [ ] **Step 1: 编写 Provider / useRecorderState 的失败测试**

创建 `__tests__/react.spec.tsx`：

```tsx
import { describe, expect, it } from 'bun:test';
import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { AudioRecorderProvider, useRecorderState } from '../src/react';
import { FakeRecorder } from './mock';

function createWrapper(props: Record<string, any> = {}) {
  let fake!: FakeRecorder;
  const wrapper = ({ children }: { children?: React.ReactNode }) => (
    <AudioRecorderProvider
      _createRecorder={(cfg: any) => {
        fake = new FakeRecorder(cfg);
        return fake as any;
      }}
      _supportsMediaDevices={() => true}
      {...props}
    >
      {children}
    </AudioRecorderProvider>
  );
  return {
    wrapper,
    getFake: () => fake,
  };
}

describe('AudioRecorderProvider + useRecorderState', () => {
  it('should expose idle state, zero duration and a lazy instance', () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useRecorderState(), { wrapper });
    expect(result.current.state).toBe('idle');
    expect(result.current.duration).toBe(0);
    expect(result.current.error).toBeNull();
    expect(result.current.instance).toBeDefined();
  });

  it('should mirror state and duration through the lifecycle', async () => {
    const { wrapper, getFake } = createWrapper();
    const { result } = renderHook(() => useRecorderState(), { wrapper });

    await act(async () => {
      await result.current.start();
    });
    expect(result.current.state).toBe('recording');
    expect(getFake().startCalled).toBe(1);

    act(() => {
      result.current.pause();
    });
    expect(result.current.state).toBe('paused');

    act(() => {
      result.current.resume();
    });
    expect(result.current.state).toBe('recording');

    let stopped: any;
    await act(async () => {
      stopped = await result.current.stop({ filename: 'a.wav' });
    });
    expect(result.current.state).toBe('stopped');
    expect(stopped.file.name).toBe('a.wav');
  });

  it('should mirror duration and forward onTimeUpdate', async () => {
    const times: number[] = [];
    const { wrapper, getFake } = createWrapper({ onTimeUpdate: (ms: number) => times.push(ms) });
    const { result } = renderHook(() => useRecorderState(), { wrapper });

    await act(async () => {
      await result.current.start();
    });
    act(() => {
      getFake().emitProgress(1.5);
    });
    expect(result.current.duration).toBe(1500);
    expect(times).toEqual([1500]);
  });

  it('should mirror errors from guarded methods and rethrow', async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useRecorderState(), { wrapper });

    expect(() => result.current.pause()).toThrow();
    expect(result.current.error?.code).toBe('INVALID_STATE');
  });

  it('should mirror stopped state after maxDuration auto-stop', async () => {
    let maxReached = false;
    const { wrapper, getFake } = createWrapper({
      maxDuration: 2000,
      onMaxReach: () => {
        maxReached = true;
      },
    });
    const { result } = renderHook(() => useRecorderState(), { wrapper });

    await act(async () => {
      await result.current.start();
    });
    act(() => {
      getFake().emitProgress(2.0);
    });
    expect(maxReached).toBe(true);
    await waitFor(() => expect(result.current.state).toBe('stopped'));
    expect(getFake().stopCalled).toBe(1);
  });

  it('should destroy the instance on unmount', async () => {
    const { wrapper, getFake } = createWrapper();
    const { result, unmount } = renderHook(() => useRecorderState(), { wrapper });
    await act(async () => {
      await result.current.start();
    });
    unmount();
    await waitFor(() => expect(getFake().destroyCalled).toBe(1));
  });

  it('should throw when hooks are used outside the provider', () => {
    expect(() => renderHook(() => useRecorderState())).toThrow(/AudioRecorderProvider/);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

运行：`bun test __tests__/react.spec.tsx`
预期：FAIL，找不到模块 `../src/react`。

- [ ] **Step 3: 实现 `src/react.tsx`（Provider + useRecorderState 部分）**

```tsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { MutableRefObject, ReactNode } from 'react';
import AudioRecorder from './index';
import type {
  AudioRecorderInternalOptions,
  RecorderState,
  StopOptions,
  StopResult,
  WavePayload,
} from './index';
import { AudioRecorderError } from './index';

export type PermissionStatus = 'granted' | 'denied' | 'prompt' | 'unknown';

export interface AudioRecorderProviderProps extends AudioRecorderInternalOptions {
  children: ReactNode;
}

interface RecorderContextValue {
  instance: AudioRecorder;
  state: RecorderState;
  duration: number;
  error: AudioRecorderError | null;
  waveDataRef: MutableRefObject<Uint8Array | null>;
  volRef: MutableRefObject<number>;
  subscribeWave: (cb: (payload: WavePayload) => void) => () => void;
  start: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: (options?: StopOptions) => Promise<StopResult>;
  destroy: () => Promise<void>;
}

const RecorderContext = createContext<RecorderContextValue | null>(null);

export function AudioRecorderProvider(props: AudioRecorderProviderProps) {
  const { children, ...options } = props;

  // Keep latest user callbacks/params reachable from stable wrappers.
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const waveDataRef = useRef<Uint8Array | null>(null);
  const volRef = useRef(0);
  const subscribersRef = useRef(new Set<(payload: WavePayload) => void>());

  const [state, setState] = useState<RecorderState>('idle');
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<AudioRecorderError | null>(null);

  const instanceRef = useRef<AudioRecorder | null>(null);

  const syncState = () => {
    if (instanceRef.current) setState(instanceRef.current.state);
  };

  if (instanceRef.current === null) {
    instanceRef.current = new AudioRecorder({
      ...options,
      onTimeUpdate: (ms) => {
        setDuration(ms);
        optionsRef.current.onTimeUpdate?.(ms);
      },
      onWaveDataUpdate: (payload) => {
        waveDataRef.current = payload.waveData;
        volRef.current = payload.vol;
        subscribersRef.current.forEach((cb) => cb(payload));
        optionsRef.current.onWaveDataUpdate?.(payload);
      },
      onError: (err) => {
        setError(err);
        optionsRef.current.onError?.(err);
      },
      onMaxReach: () => {
        optionsRef.current.onMaxReach?.();
        // Core auto-stops right after this callback; mirror it on the next tick.
        void Promise.resolve().then(syncState);
      },
    });
  }
  const instance = instanceRef.current;

  useEffect(() => {
    return () => {
      void instanceRef.current?.destroy();
    };
  }, [instance]);

  const subscribeWave = useCallback((cb: (payload: WavePayload) => void) => {
    subscribersRef.current.add(cb);
    return () => {
      subscribersRef.current.delete(cb);
    };
  }, []);

  const runSync = (fn: () => void) => {
    try {
      fn();
    } catch (err) {
      setError(err as AudioRecorderError);
      throw err;
    } finally {
      syncState();
    }
  };

  const runAsync = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (err) {
      setError(err as AudioRecorderError);
      throw err;
    } finally {
      syncState();
    }
  };

  const start = useCallback(() => runAsync(() => instance.start()), [instance]);
  const stop = useCallback(
    (stopOptions?: StopOptions) => runAsync(() => instance.stop(stopOptions)),
    [instance]
  );
  const destroy = useCallback(() => runAsync(() => instance.destroy()), [instance]);
  const pause = useCallback(() => runSync(() => instance.pause()), [instance]);
  const resume = useCallback(() => runSync(() => instance.resume()), [instance]);

  const value = useMemo<RecorderContextValue>(
    () => ({
      instance,
      state,
      duration,
      error,
      waveDataRef,
      volRef,
      subscribeWave,
      start,
      pause,
      resume,
      stop,
      destroy,
    }),
    [instance, state, duration, error, subscribeWave, start, pause, resume, stop, destroy]
  );

  return <RecorderContext.Provider value={value}>{children}</RecorderContext.Provider>;
}

export function useRecorderState(): Omit<RecorderContextValue, 'subscribeWave'> {
  const ctx = useContext(RecorderContext);
  if (!ctx) {
    throw new Error('useRecorderState must be used within <AudioRecorderProvider>');
  }
  return ctx;
}
```

注意：`src/react.tsx` 顶部还需在 Task 3/4 追加 `useWaveform` / `usePermission`，本任务先只写以上内容。

- [ ] **Step 4: 运行测试验证通过**

运行：`bun test __tests__/react.spec.tsx`
预期：PASS（7 个测试全部通过）。

- [ ] **Step 5: 提交**

```bash
git add src/react.tsx __tests__/react.spec.tsx
git commit -m "feat: add AudioRecorderProvider and useRecorderState hook"
```

---

### Task 3: 实现 `useWaveform`

**Files:**
- Modify: `src/react.tsx`
- Modify: `__tests__/react.spec.tsx`

- [ ] **Step 1: 编写 useWaveform 的失败测试**

在 `__tests__/react.spec.tsx` 顶部补充导入：

```tsx
import { useWaveform } from '../src/react';
```

追加测试：

```tsx
describe('useWaveform', () => {
  it('should update refs without exposing waveform state by default', async () => {
    const { wrapper, getFake } = createWrapper();
    const { result: recorder } = renderHook(() => useRecorderState(), { wrapper });
    const { result: wave } = renderHook(() => useWaveform(), { wrapper });

    await act(async () => {
      await recorder.current.start();
    });
    act(() => {
      getFake().emitProgress(1.5, 75);
    });

    expect(wave.current.waveDataRef.current?.length).toBe(1024);
    expect(wave.current.volRef.current).toBe(75);
    expect(wave.current.waveData).toBeNull();
    expect(wave.current.vol).toBe(0);
  });

  it('should expose waveform state when { state: true }', async () => {
    const { wrapper, getFake } = createWrapper();
    const { result: recorder } = renderHook(() => useRecorderState(), { wrapper });
    const { result: wave } = renderHook(() => useWaveform({ state: true }), { wrapper });

    await act(async () => {
      await recorder.current.start();
    });
    act(() => {
      getFake().emitProgress(1.5, 75);
    });

    expect(wave.current.waveData?.length).toBe(1024);
    expect(wave.current.vol).toBe(75);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

运行：`bun test __tests__/react.spec.tsx`
预期：FAIL，`useWaveform` 未导出。

- [ ] **Step 3: 在 `src/react.tsx` 追加实现**

在文件末尾追加：

```tsx
export interface UseWaveformOptions {
  /** Opt into React state updates for waveData/vol (re-renders every tick). */
  state?: boolean;
}

export function useWaveform(options: UseWaveformOptions = {}) {
  const ctx = useContext(RecorderContext);
  if (!ctx) {
    throw new Error('useWaveform must be used within <AudioRecorderProvider>');
  }
  const enableState = options.state ?? false;
  const [waveData, setWaveData] = useState<Uint8Array | null>(null);
  const [vol, setVol] = useState(0);

  useEffect(() => {
    if (!enableState) return;
    return ctx.subscribeWave((payload) => {
      setWaveData(payload.waveData);
      setVol(payload.vol);
    });
  }, [enableState, ctx.subscribeWave]);

  return { waveDataRef: ctx.waveDataRef, volRef: ctx.volRef, waveData, vol };
}
```

- [ ] **Step 4: 运行测试验证通过**

运行：`bun test __tests__/react.spec.tsx`
预期：PASS。

- [ ] **Step 5: 提交**

```bash
git add src/react.tsx __tests__/react.spec.tsx
git commit -m "feat: add useWaveform hook with ref-first updates"
```

---

### Task 4: 实现 `usePermission`

**Files:**
- Modify: `src/react.tsx`
- Modify: `__tests__/react.spec.tsx`

- [ ] **Step 1: 编写 usePermission 的失败测试**

补充导入：

```tsx
import { usePermission } from '../src/react';
import AudioRecorder from '../src/index';
```

追加测试：

```tsx
describe('usePermission', () => {
  it('should stay unknown in headless env and follow checkPermission via refresh', async () => {
    const original = AudioRecorder.checkPermission;
    const { result } = renderHook(() => usePermission());
    // happy-dom has no mic permission state: initial query throws / unsupported
    expect(['unknown', 'prompt']).toContain(result.current.status);

    (AudioRecorder as any).checkPermission = async () => 'granted' as const;
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.status).toBe('granted');

    (AudioRecorder as any).checkPermission = original;
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

运行：`bun test __tests__/react.spec.tsx`
预期：FAIL，`usePermission` 未导出。

- [ ] **Step 3: 在 `src/react.tsx` 追加实现**

```tsx
export function usePermission() {
  const [status, setStatus] = useState<PermissionStatus>('unknown');

  const refresh = useCallback(async () => {
    if (typeof window === 'undefined') return;
    try {
      setStatus(await AudioRecorder.checkPermission());
    } catch {
      setStatus('unknown');
    }
  }, []);

  useEffect(() => {
    void refresh();
    if (typeof navigator === 'undefined' || !navigator.permissions?.addEventListener) return;

    let attached: PermissionStatus | null = null;
    let stale = false;
    const handler = function (this: PermissionStatus) {
      const next = this.state;
      if (next === 'granted' || next === 'denied' || next === 'prompt') setStatus(next);
    };

    navigator.permissions
      .query({ name: 'microphone' as PermissionName })
      .then((ps) => {
        if (stale) return;
        attached = ps;
        ps.addEventListener('change', handler);
      })
      .catch(() => {
        // Safari cannot query microphone; manual refresh() remains available.
      });

    return () => {
      stale = true;
      attached?.removeEventListener('change', handler);
    };
  }, [refresh]);

  return { status, refresh };
}
```

- [ ] **Step 4: 运行全部测试验证通过**

运行：`bun test`
预期：全部 PASS（含原有 18 个与新增 React 测试）。

- [ ] **Step 5: 提交**

```bash
git add src/react.tsx __tests__/react.spec.tsx
git commit -m "feat: add usePermission hook"
```

---

### Task 5: 构建配置与子路径导出

**Files:**
- Modify: `tsup.config.ts`
- Modify: `package.json`

- [ ] **Step 1: `tsup.config.ts` 双 entry + react external**

`baseOptions` 中：

1. `entry` 改为 `['src/index.ts', 'src/react.tsx']`
2. 在 `noExternal` 一行之后加入：

```ts
  // React is a peer dependency; never bundle it into dist
  external: ['react', 'react-dom'],
```

`umdOptions` 保持 `entry: ['src/index.ts']` 不变（UMD 仅核心）。

- [ ] **Step 2: `package.json` 增加 exports 映射与 peerDependencies**

在 `"types": "dist/index.d.ts",` 之后插入：

```json
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.esm.js",
      "require": "./dist/index.cjs.js"
    },
    "./react": {
      "types": "./dist/react.d.ts",
      "import": "./dist/react.esm.js",
      "require": "./dist/react.cjs.js"
    }
  },
```

在 `"license": "MIT",` 之后插入：

```json
  "peerDependencies": {
    "react": ">=16.8",
    "react-dom": ">=16.8"
  },
```

- [ ] **Step 3: 构建并验证产物**

运行：

```bash
pnpm run build && ls dist/
pnpm tsc --noEmit && bun test
```

预期：
- `dist/` 新增 `react.esm.js`、`react.cjs.js`、`react.d.ts`
- `dist/react.esm.js` 中存在 `from "react"`（external 生效），且无 react 源码内联（文件 < 20KB）
- 类型检查与全部测试 PASS

- [ ] **Step 4: 提交**

```bash
git add tsup.config.ts package.json
git commit -m "chore: export react subpath entry with peer dependencies"
```

---

### Task 6: 示例工程 `file:` 安装与示例页

**Files:**
- （外部工程 `/Users/afei/github/aric-notes/audio-recorder-kit-notes`）
- Modify: `package.json`（由 pnpm 自动写入）
- Create: `src/recorder-demo.tsx`
- Modify: `src/app.tsx`

- [ ] **Step 1: 以 file: 协议安装本地包**

```bash
cd /Users/afei/github/aric-notes/audio-recorder-kit-notes
pnpm add "file:/Users/afei/github/audio-recorder-kit"
```

预期：`package.json` dependencies 出现 `"@jswork/audio-recorder-kit": "file:..."`。

- [ ] **Step 2: 创建 `src/recorder-demo.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react';
import {
  AudioRecorderProvider,
  useRecorderState,
  useWaveform,
  usePermission,
} from '@jswork/audio-recorder-kit/react';
import type { StopResult } from '@jswork/audio-recorder-kit';

function WaveCanvas() {
  const { waveDataRef } = useWaveform();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let raf = 0;
    const draw = () => {
      const canvas = canvasRef.current;
      const data = waveDataRef.current;
      if (canvas && data) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#181818';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.strokeStyle = '#00e676';
          ctx.lineWidth = 2;
          ctx.beginPath();
          const step = canvas.width / data.length;
          for (let i = 0; i < data.length; i++) {
            const y = ((data[i] / 128) * canvas.height) / 2;
            if (i === 0) ctx.moveTo(0, y);
            else ctx.lineTo(i * step, y);
          }
          ctx.stroke();
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [waveDataRef]);

  return <canvas ref={canvasRef} width={600} height={120} className="mt-3 w-full rounded" />;
}

function ControlPanel() {
  const { state, duration, error, start, pause, resume, stop } = useRecorderState();
  const { volRef } = useWaveform();
  const [vol, setVol] = useState(0);
  const [result, setResult] = useState<StopResult | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setVol(volRef.current), 100);
    return () => clearInterval(timer);
  }, [volRef]);

  const onStop = async () => {
    setResult(await stop({ filename: `dsr_${Date.now()}.wav` }));
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button className="rounded border border-gray-300 px-3 py-1.5 disabled:opacity-50" onClick={() => start()} disabled={state === 'recording' || state === 'paused'}>
          开始
        </button>
        <button className="rounded border border-gray-300 px-3 py-1.5 disabled:opacity-50" onClick={() => pause()} disabled={state !== 'recording'}>
          暂停
        </button>
        <button className="rounded border border-gray-300 px-3 py-1.5 disabled:opacity-50" onClick={() => resume()} disabled={state !== 'paused'}>
          继续
        </button>
        <button className="rounded border border-gray-300 px-3 py-1.5 disabled:opacity-50" onClick={onStop} disabled={state !== 'recording' && state !== 'paused'}>
          停止
        </button>
      </div>
      <div>
        状态: <b>{state}</b> | 时长: <b>{(duration / 1000).toFixed(1)}s</b> | 音量: <b>{vol}</b>
        {error && <span className="ml-2 text-red-500">{error.code}</span>}
      </div>
      <div className="h-2 w-full overflow-hidden rounded bg-gray-200">
        <div className="h-full bg-green-500 transition-all" style={{ width: `${vol}%` }} />
      </div>
      <WaveCanvas />
      {result && (
        <pre className="rounded bg-gray-100 p-3 text-xs">
          {JSON.stringify(
            { file: result.file.name, size: result.file.size, type: result.file.type, duration: result.duration },
            null,
            2
          )}
        </pre>
      )}
      {result && <audio className="w-full" controls src={result.url} />}
    </div>
  );
}

export default function RecorderDemo() {
  const { status, refresh } = usePermission();
  return (
    <AudioRecorderProvider sampleRate={16000} sampleBits={16} numChannels={1} maxDuration={30_000}>
      <div className="space-y-2">
        <div className="text-sm text-gray-500">
          麦克风权限: {status}
          <button className="ml-2 rounded border border-gray-300 px-2 py-0.5 text-xs" onClick={() => refresh()}>
            刷新
          </button>
        </div>
        <ControlPanel />
      </div>
    </AudioRecorderProvider>
  );
}
```

- [ ] **Step 3: 挂入 `src/app.tsx`**

```tsx
import RecorderDemo from './recorder-demo';

export default function App() {
  return (
    <div className="debug container mx-auto my-10 bg-gray-200 p-5" data-role="app-container">
      <h1 className="text-3xl font-bold">AudioRecorder Kit Demo</h1>
      <RecorderDemo />
    </div>
  );
}
```

- [ ] **Step 4: 本地验证**

```bash
pnpm dev
```

浏览器打开 Vite 输出的地址，验证：页面渲染、按钮状态随录音状态切换、console 无报错（真实录音需手动允许麦克风权限）。

- [ ] **Step 5: 提交（notes 仓库）**

```bash
git add package.json pnpm-lock.yaml src/recorder-demo.tsx src/app.tsx
git commit -m "feat: add audio recorder hooks demo with file: dependency"
```

---

### Task 7: 收尾验证

- [ ] **Step 1: 主仓库全量验证**

```bash
cd /Users/afei/github/audio-recorder-kit
pnpm tsc --noEmit && bun test && pnpm run build
```

预期：全部 PASS / 构建成功。

- [ ] **Step 2: 提交剩余改动（如有）并汇报**

无遗留未提交文件即为完成。
