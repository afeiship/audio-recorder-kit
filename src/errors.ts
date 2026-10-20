import { ErrorCode } from './types';

export class AudioRecorderError extends Error {
  readonly code: ErrorCode;
  readonly rawError?: unknown;

  constructor(code: ErrorCode, message: string, rawError?: unknown) {
    super(message);
    this.name = 'AudioRecorderError';
    this.code = code;
    this.rawError = rawError;
    if (typeof Object.setPrototypeOf === 'function') {
      Object.setPrototypeOf(this, AudioRecorderError.prototype);
    }
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
