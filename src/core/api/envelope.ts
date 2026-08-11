import { z } from 'zod';

/**
 * The backend response envelope (docs-hub-api). EVERY response except 204 has
 * this shape, and `success` — not the HTTP status — is the authority:
 *
 *   - Technical failures (validation, auth, not-found, server) use HTTP 4xx/5xx.
 *   - BUSINESS failures come back as **HTTP 200 with `success: false`**
 *     (duplicate email, wrong confirm name, already a member, …).
 *
 * That second case is the whole reason this module exists. Axios resolves any
 * 2xx, so a `success:false` body would otherwise flow into `.data` and be parsed
 * as a valid result. `unwrap()` below is the single choke point that turns it
 * into an AppError instead.
 */
export const ApiPaginationSchema = z.object({
  page: z.number().int(),
  limit: z.number().int(),
  total_items: z.number().int(),
  total_pages: z.number().int(),
  has_next: z.boolean(),
  has_prev: z.boolean(),
});

export const ApiMetaSchema = z
  .object({
    request_id: z.string().optional(),
    trace_id: z.string().optional(),
    timestamp: z.string().optional(),
    pagination: ApiPaginationSchema.optional(),
  })
  .loose();

export const ApiErrorBodySchema = z.object({
  code: z.string(),
  message: z.string(),
  /**
   * On 400 this is `{ "<FieldName>": "<message>" }`. Body fields arrive in Go's
   * PascalCase (`"Name"`, `"ConfirmName"`), path params in snake_case (`"id"`).
   */
  details: z.record(z.string(), z.unknown()).nullish(),
  retryable: z.boolean().nullish(),
});

/** Envelope with an unknown payload — used to inspect `success` before parsing. */
export const ApiEnvelopeSchema = z.object({
  success: z.boolean(),
  data: z.unknown().nullish(),
  error: ApiErrorBodySchema.nullish(),
  meta: ApiMetaSchema.nullish(),
});

export type ApiPagination = z.infer<typeof ApiPaginationSchema>;
export type ApiMeta = z.infer<typeof ApiMetaSchema>;
export type ApiErrorBody = z.infer<typeof ApiErrorBodySchema>;

/** A page of results plus the pagination block from `meta`. */
export interface Paginated<T> {
  items: T[];
  pagination?: ApiPagination;
}
