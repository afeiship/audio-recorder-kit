import { describe, expect, it } from 'bun:test';
import AudioRecorder from '../src/index';
import { AudioRecorderError } from '../src/errors';
import { FakeRecorder } from './mock';

describe('AudioRecorder - Lifecycle & State Guards', () => {
  it('should initialize in idle state and duration 0', () => {
    const recorder = new AudioRecorder({
      _createRecorder: (cfg) => new FakeRecorder(cfg) as any,
    });
    expect(recorder.state).toBe('idle');
    expect(recorder.duration).toBe(0);
  });

  it('should throw MAX_DURATION_INVALID with correct code', () => {
    for (const bad of [-10, 0, NaN]) {
      try {
        new AudioRecorder({ maxDuration: bad });
        throw new Error('should have thrown');
      } catch (e: any) {
        expect(e.code).toBe('MAX_DURATION_INVALID');
      }
    }
  });

  it('should throw INVALID_STATE on illegal state transitions', async () => {
    const recorder = new AudioRecorder({
      _createRecorder: (cfg) => new FakeRecorder(cfg) as any,
    });

    let err: any;
    try { recorder.pause(); } catch (e) { err = e; }
    expect(err.code).toBe('INVALID_STATE');

    try { recorder.resume(); } catch (e) { err = e; }
    expect(err.code).toBe('INVALID_STATE');

    await recorder.stop().catch((e) => { err = e; });
    expect(err.code).toBe('INVALID_STATE');
  });
});

describe('AudioRecorder - Recording & callbacks', () => {
  function createRecorder(opts: any = {}) {
    // Fake is created eagerly so tests can configure it (e.g. shouldThrowOnStart)
    // before start() lazily invokes _createRecorder; the same instance is reused.
    const fake = new FakeRecorder();
    const recorder = new AudioRecorder({
      _supportsMediaDevices: () => true,
      _createRecorder: (cfg) => {
        fake.config = cfg;
        return fake as any;
      },
      ...opts,
    });
    return { recorder, getFake: () => fake };
  }

  it('should transition idle -> recording on start() and reset duration', async () => {
    const { recorder, getFake } = createRecorder();
    await recorder.start();
    expect(recorder.state).toBe('recording');
    expect(getFake().startCalled).toBe(1);

    getFake().emitProgress(2);
    expect(recorder.duration).toBe(2000);

    await recorder.stop();
    await recorder.start(); // new session resets duration
    expect(recorder.duration).toBe(0);
  });

  it('should map start() failure to PERMISSION_DENIED and keep state', async () => {
    const { recorder, getFake } = createRecorder();
    getFake().shouldThrowOnStart = new DOMException('denied', 'NotAllowedError');
    await expect(recorder.start()).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    expect(recorder.state).toBe('idle');
  });

  it('should fire onTimeUpdate and onWaveDataUpdate with ms duration', async () => {
    let timeVal = -1;
    let wave: any = null;
    const { recorder, getFake } = createRecorder({
      onTimeUpdate: (d) => { timeVal = d; },
      onWaveDataUpdate: (p) => { wave = p; },
    });

    await recorder.start();
    getFake().emitProgress(1.5, 75);

    expect(timeVal).toBe(1500);
    expect(wave).not.toBeNull();
    expect(wave.vol).toBe(75);
    expect(wave.waveData.length).toBe(2048);
    expect(wave.duration).toBe(1500);
  });

  it('should NOT fire callbacks while paused or stopped', async () => {
    let fired = 0;
    const { recorder, getFake } = createRecorder({
      onTimeUpdate: () => { fired++; },
    });

    await recorder.start();
    getFake().emitProgress(0.1);
    expect(fired).toBe(1);

    recorder.pause();
    getFake().emitProgress(0.2); // late event must be ignored
    expect(fired).toBe(1);
    expect(recorder.duration).toBe(100);

    recorder.resume();
    getFake().emitProgress(0.3);
    expect(fired).toBe(2);

    await recorder.stop();
    getFake().emitProgress(0.4);
    expect(fired).toBe(2);
  });

  it('should trigger onMaxReach then auto-stop at maxDuration', async () => {
    const events: string[] = [];
    const { recorder, getFake } = createRecorder({
      maxDuration: 2000,
      onTimeUpdate: () => events.push('time'),
      onMaxReach: () => events.push('max'),
    });

    await recorder.start();
    getFake().emitProgress(1.0);
    expect(recorder.state).toBe('recording');

    getFake().emitProgress(2.0);
    // onMaxReach fires before/with auto-stop; allow microtask flush
    await new Promise((r) => setTimeout(r, 0));
    expect(events).toContain('max');
    expect(recorder.state).toBe('stopped');
    expect(getFake().stopCalled).toBe(1);
  });

  it('should return blob, file, url, duration from stop() with custom filename', async () => {
    const { recorder, getFake } = createRecorder();
    await recorder.start();
    getFake().emitProgress(3.5);

    const result = await recorder.stop({ filename: 'question_99.wav' });
    expect(recorder.state).toBe('stopped');
    expect(result.duration).toBe(3500);
    expect(result.blob).toBeInstanceOf(Blob);
    expect(result.file).toBeInstanceOf(File);
    expect(result.file.name).toBe('question_99.wav');
    expect(result.file.type).toBe('audio/wav');
    expect(typeof result.url).toBe('string');
    expect(result.url.startsWith('blob:')).toBe(true);
  });

  it('should stop from paused state', async () => {
    const { recorder, getFake } = createRecorder();
    await recorder.start();
    getFake().emitProgress(1);
    recorder.pause();
    const result = await recorder.stop();
    expect(result.duration).toBe(1000);
  });
});
