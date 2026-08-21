import { z } from 'zod';

/**
 * API response envelope — the contract we define (mock-first). Every backend
 * response, success or failure, is wrapped in this shape. Zod is the source of
 * truth; MSW handlers build responses with the same helpers so mocks can never
 * drift from the contract.
 */
/**
 * Envelope metadata.
 *
 * Two producers write this shape and they disagree on casing: docs-hub-api sends
 * snake_case (`request_id`, plus `trace_id` and `pagination`), while this app's
 * own route handlers use `successEnvelope`, which emits camelCase. Accepting both
 * — and normalising to `requestId` — is what lets one client parse either.
 *
 * Requiring only `timestamp` is deliberate: a missing correlation id is worth a
 * degraded log line, never a thrown parse that blanks the screen.
 */
export const ApiMetaSchema = z
  .object({
    requestId: z.string().optional(),
    request_id: z.string().optional(),
    timestamp: z.string(),
  })
  .loose()
  .transform(({ requestId, request_id, ...rest }) => ({
    ...rest,
    requestId: requestId ?? request_id ?? '',
  }));

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
  /** Backend hint that retrying the same call may succeed (e.g. version conflict). */
  readonly retryable: boolean;
  /**
   * True when the backend reported this via `success:false` on an HTTP 200 —
   * i.e. an expected business outcome, not a fault. The UI should show
   * `message` inline on the form rather than as a system error.
   */
  readonly isBusiness: boolean;

  constructor(params: {
    code: string;
    message: string;
    status: number;
    details?: Record<string, unknown>;
    retryable?: boolean;
    isBusiness?: boolean;
  }) {
    super(params.message);
    this.name = 'AppError';
    this.code = params.code;
    this.status = params.status;
    this.details = params.details;
    this.retryable = params.retryable ?? false;
    this.isBusiness = params.isBusiness ?? false;
  }

  /** True for 401 — callers use this to trigger the login redirect. */
  get isUnauthorized(): boolean {
    return this.status === 401 || this.code === ERROR_CODE.AUTH;
  }

  /**
   * Field-level validation messages from a 400, keyed by the backend's field
   * name. Body fields arrive PascalCase (`Name`), path params snake_case (`id`),
   * so callers look up whichever the endpoint uses.
   */
  fieldError(...names: string[]): string | undefined {
    for (const name of names) {
      const value = this.details?.[name];
      if (typeof value === 'string') return value;
    }
    return undefined;
  }
}

/**
 * Error codes. The `ERR_*` values are client-side (transport never reached the
 * backend); the rest mirror the backend taxonomy so callers can branch on a
 * specific business outcome without string literals scattered through features.
 */
export const ERROR_CODE = {
  // Client-side transport failures.
  NETWORK: 'ERR_NETWORK',
  TIMEOUT: 'ERR_TIMEOUT',
  CANCELED: 'ERR_CANCELED',
  UNKNOWN: 'ERR_UNKNOWN',

  // Backend technical codes.
  VALIDATION: 'REQ_400',
  AUTH: 'AUTH_401',
  USER_NOT_FOUND: 'USR_404',
  PROJECT_NOT_FOUND: 'PRJ_404',
  MEMBER_NOT_FOUND: 'MBR_404',

  // Backend business codes (always HTTP 200 + success:false).
  DUPLICATE_EMAIL: 'DUPLICATE_EMAIL',
  USER_LOCKED: 'USER_LOCKED',
  CONFLICT_VERSION: 'CONFLICT_VERSION',
  INVALID_PROFILE: 'INVALID_PROFILE',
  ALREADY_MEMBER: 'ALREADY_MEMBER',
  INVITE_NOT_PENDING: 'INVITE_NOT_PENDING',
  CANNOT_MODIFY_OWNER: 'CANNOT_MODIFY_OWNER',
  CONFIRM_NAME_MISMATCH: 'CONFIRM_NAME_MISMATCH',
  IMAGE_INVALID: 'IMAGE_INVALID',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  AVATAR_NOT_UPLOADED: 'AVATAR_NOT_UPLOADED',
} as const;
