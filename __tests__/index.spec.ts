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

  it('should throw MAX_DURATION_INVALID when maxDuration is invalid', () => {
    expect(() => new AudioRecorder({ maxDuration: -10 })).toThrow(AudioRecorderError);
    expect(() => new AudioRecorder({ maxDuration: 0 })).toThrow(AudioRecorderError);
    expect(() => new AudioRecorder({ maxDuration: NaN })).toThrow(AudioRecorderError);
  });

  it('should throw INVALID_STATE on illegal state transitions', async () => {
    const recorder = new AudioRecorder({
      _createRecorder: (cfg) => new FakeRecorder(cfg) as any,
    });

    expect(() => recorder.pause()).toThrow(AudioRecorderError);
    expect(() => recorder.resume()).toThrow(AudioRecorderError);
    await expect(recorder.stop()).rejects.toThrow(AudioRecorderError);
  });
});
