import { randomUUID } from 'node:crypto';

/** Wrap mock data in the success envelope the client/server fetchers expect. */
export function envelope<T>(data: T) {
  return {
    success: true as const,
    data,
    meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
  };
}

/** Wrap a mock error in the failure envelope. */
export function failure(code: string, message: string, details?: Record<string, unknown>) {
  return {
    success: false as const,
    error: { code, message, ...(details ? { details } : {}) },
    meta: { requestId: randomUUID(), timestamp: new Date().toISOString() },
  };
}
