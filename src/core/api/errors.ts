import { z } from 'zod';

/**
 * API response envelope — the contract we define (mock-first). Every backend
 * response, success or failure, is wrapped in this shape. Zod is the source of
 * truth; MSW handlers build responses with the same helpers so mocks can never
 * drift from the contract.
 */
export const ApiMetaSchema = z.object({
  requestId: z.string(),
  timestamp: z.string(),
});

export const ApiErrorBodySchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
});

export function apiSuccessSchema<T extends z.ZodTypeAny>(data: T) {
  return z.object({
    success: z.literal(true),
    data,
    meta: ApiMetaSchema,
  });
}

export const ApiFailureSchema = z.object({
  success: z.literal(false),
  error: ApiErrorBodySchema,
  meta: ApiMetaSchema,
});

/**
 * Build the success envelope from a route handler. `meta` is REQUIRED by
 * `apiSuccessSchema`, so a handler that hand-rolls `{ success, data }` produces a
 * body its own client cannot parse — use this instead of an object literal.
 */
export function successEnvelope<T>(data: T) {
  return {
    success: true as const,
    data,
    meta: { requestId: crypto.randomUUID(), timestamp: new Date().toISOString() },
  };
}

/** Failure counterpart of `successEnvelope`, for route handlers. */
export function failureEnvelope(code: string, message: string) {
  return {
    success: false as const,
    error: { code, message },
    meta: { requestId: crypto.randomUUID(), timestamp: new Date().toISOString() },
  };
}

export type ApiMeta = z.infer<typeof ApiMetaSchema>;
export type ApiErrorBody = z.infer<typeof ApiErrorBodySchema>;

/**
 * Canonical, transport-agnostic error the whole app throws and catches. Axios
 * errors, fetch failures, and backend `success:false` bodies are all normalized
 * into this one type so UI/hooks never branch on Axios internals.
 */
export class AppError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor(params: {
    code: string;
    message: string;
    status: number;
    details?: Record<string, unknown>;
  }) {
    super(params.message);
    this.name = 'AppError';
    this.code = params.code;
    this.status = params.status;
    this.details = params.details;
  }

  /** True for 401 — callers use this to trigger the login redirect. */
  get isUnauthorized(): boolean {
    return this.status === 401;
  }
}

/** Well-known client-side error codes (network/timeout/unknown). */
export const ERROR_CODE = {
  NETWORK: 'ERR_NETWORK',
  TIMEOUT: 'ERR_TIMEOUT',
  CANCELED: 'ERR_CANCELED',
  UNKNOWN: 'ERR_UNKNOWN',
} as const;
