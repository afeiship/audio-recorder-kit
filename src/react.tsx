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
import { flushSync } from 'react-dom';
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
  const destroyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const syncState = () => {
    const inst = instanceRef.current;
    if (inst) {
      setState(inst.state);
      setDuration(inst.duration);
    }
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
    // Cancel a destroy scheduled by a previous cleanup (StrictMode remount)
    if (destroyTimerRef.current !== null) {
      clearTimeout(destroyTimerRef.current);
      destroyTimerRef.current = null;
    }
    return () => {
      destroyTimerRef.current = setTimeout(() => {
        destroyTimerRef.current = null;
        void instanceRef.current?.destroy();
      }, 0);
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
      // Mirror the error synchronously so it is observable right after the
      // rethrown exception, even outside act()/React event handlers.
      flushSync(() => {
        setError(err as AudioRecorderError);
        syncState();
      });
      throw err;
    } finally {
      syncState();
    }
  };

  const runAsync = async <T,>(fn: () => Promise<T>): Promise<T> => {
    try {
      return await fn();
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
