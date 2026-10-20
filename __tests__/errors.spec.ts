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
