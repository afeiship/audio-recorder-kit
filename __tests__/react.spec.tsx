import { describe, expect, it } from 'bun:test';
import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import {
  AudioRecorderProvider,
  usePermission,
  useRecorderState,
  useWaveform,
} from '../src/react';
import AudioRecorder from '../src/index';
import { FakeRecorder } from './mock';

function createWrapper(props: Record<string, any> = {}, onCreate?: (fake: FakeRecorder) => void) {
  let fake!: FakeRecorder;
  const wrapper = ({ children }: { children?: React.ReactNode }) => (
    <AudioRecorderProvider
      _createRecorder={(cfg: any) => {
        fake = new FakeRecorder(cfg);
        onCreate?.(fake);
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

  it('should survive StrictMode double-mount', async () => {
    let fake!: FakeRecorder;
    const { result } = renderHook(() => useRecorderState(), {
      wrapper: ({ children }: { children?: React.ReactNode }) => (
        <React.StrictMode>
          <AudioRecorderProvider
            _createRecorder={(cfg: any) => {
              fake = new FakeRecorder(cfg);
              return fake as any;
            }}
            _supportsMediaDevices={() => true}
          >
            {children}
          </AudioRecorderProvider>
        </React.StrictMode>
      ),
    });
    await act(async () => {
      await result.current.start();
    });
    expect(result.current.state).toBe('recording');
    expect(fake.startCalled).toBe(1);
  });

  it('should reset duration mirror when restarting a session', async () => {
    const { wrapper, getFake } = createWrapper();
    const { result } = renderHook(() => useRecorderState(), { wrapper });
    await act(async () => {
      await result.current.start();
    });
    act(() => {
      getFake().emitProgress(1.5);
    });
    expect(result.current.duration).toBe(1500);
    await act(async () => {
      await result.current.stop();
    });
    await act(async () => {
      await result.current.start();
    });
    expect(result.current.duration).toBe(0);
    expect(result.current.state).toBe('recording');
  });

  it('should forward core onError and mirror start() rejection', async () => {
    const errors: string[] = [];
    const { wrapper } = createWrapper(
      { onError: (e: any) => errors.push(e.code) },
      (f) => {
        f.shouldThrowOnStart = new DOMException('denied', 'NotAllowedError');
      }
    );
    const { result } = renderHook(() => useRecorderState(), { wrapper });
    await act(async () => {
      await expect(result.current.start()).rejects.toThrow();
    });
    expect(result.current.error?.code).toBe('PERMISSION_DENIED');
    expect(errors).toContain('PERMISSION_DENIED');
  });
});

describe('useWaveform', () => {
  it('should update refs without exposing waveform state by default', async () => {
    const { wrapper, getFake } = createWrapper();
    const { result } = renderHook(
      () => ({ rec: useRecorderState(), wave: useWaveform() }),
      { wrapper }
    );

    await act(async () => {
      await result.current.rec.start();
    });
    act(() => {
      getFake().emitProgress(1.5, 75);
    });

    expect(result.current.wave.waveDataRef.current?.length).toBe(1024);
    expect(result.current.wave.volRef.current).toBe(75);
    expect(result.current.wave.waveData).toBeNull();
    expect(result.current.wave.vol).toBe(0);
  });

  it('should expose waveform state when { state: true }', async () => {
    const { wrapper, getFake } = createWrapper();
    const { result } = renderHook(
      () => ({ rec: useRecorderState(), wave: useWaveform({ state: true }) }),
      { wrapper }
    );

    await act(async () => {
      await result.current.rec.start();
    });
    act(() => {
      getFake().emitProgress(1.5, 75);
    });

    expect(result.current.wave.waveData?.length).toBe(1024);
    expect(result.current.wave.vol).toBe(75);
  });
});

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
