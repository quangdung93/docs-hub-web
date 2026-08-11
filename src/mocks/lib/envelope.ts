import { randomUUID } from 'node:crypto';

/**
 * Mock responses in the docs-hub-api envelope shape. Keeping the mock faithful to
 * the real contract — including `meta.pagination` and the business-failure
 * convention — is what lets `unwrap` be exercised in development.
 */
function meta(pagination?: unknown) {
  return {
    request_id: randomUUID(),
    trace_id: randomUUID(),
    timestamp: new Date().toISOString(),
    ...(pagination ? { pagination } : {}),
  };
}

/** Success envelope. Pass `pagination` for list endpoints. */
export function envelope<T>(
  data: T,
  pagination?: {
    page: number;
    limit: number;
    total_items: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  }
) {
  return { success: true as const, data, error: null, meta: meta(pagination) };
}

/**
 * Business failure — returned with **HTTP 200** to match the backend, which
 * signals expected outcomes (duplicate email, name mismatch) this way rather
 * than with a 4xx.
 */
export function failure(
  code: string,
  message: string,
  options?: { details?: Record<string, unknown>; retryable?: boolean }
) {
  return {
    success: false as const,
    data: null,
    error: {
      code,
      message,
      details: options?.details ?? null,
      retryable: options?.retryable ?? false,
    },
    meta: meta(),
  };
}

/** Build the pagination block for a slice of a list. */
export function paginate(totalItems: number, page: number, limit: number) {
  const totalPages = Math.max(1, Math.ceil(totalItems / limit));
  return {
    page,
    limit,
    total_items: totalItems,
    total_pages: totalPages,
    has_next: page < totalPages,
    has_prev: page > 1,
  };
}
