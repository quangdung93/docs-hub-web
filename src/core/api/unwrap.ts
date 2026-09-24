import type { z } from 'zod';

import { ApiEnvelopeSchema, type ApiPagination, type Paginated } from './envelope';
import { AppError, ERROR_CODE } from './errors';

/**
 * Lỗi nghiệp vụ trong một body 2xx, hoặc null nếu body không phải lỗi.
 *
 * Backend báo thất bại nghiệp vụ bằng HTTP 200 kèm `success:false` (ví dụ
 * `DUPLICATE_CONTENT` khi tải lên file trùng nội dung). Axios coi đó là thành
 * công, nên interceptor của `shared/api/http` gọi hàm này để từ chối ngay tại
 * transport — không để body lỗi trôi tới chỗ parse bằng schema thành công rồi
 * hiện ra dưới dạng một khối lỗi Zod vô nghĩa.
 *
 * Body không phải envelope (blob tải file, HTML) thì trả null: không đoán bừa.
 */
export function businessError(body: unknown): AppError | null {
  const envelope = ApiEnvelopeSchema.safeParse(body);
  if (!envelope.success || envelope.data.success) return null;

  const { error } = envelope.data;
  return new AppError({
    code: error?.code ?? ERROR_CODE.UNKNOWN,
    message: error?.message ?? 'Request failed',
    status: 200,
    details: (error?.details ?? undefined) as Record<string, unknown> | undefined,
    retryable: error?.retryable ?? false,
    isBusiness: true,
  });
}

/**
 * The single place a backend response body becomes typed application data.
 *
 * Every `api/` module goes through here rather than reading `response.data`
 * directly, because the backend signals business failures with **HTTP 200 and
 * `success: false`**. Axios resolves those, so without this check a failed
 * "delete project" would be indistinguishable from a successful one.
 *
 * Order matters: check `success` first, validate the payload second. Parsing a
 * failure body against a success schema produces a confusing Zod error instead
 * of the actual backend message.
 */
export function unwrap<S extends z.ZodTypeAny>(body: unknown, schema: S): z.infer<S> {
  const envelope = ApiEnvelopeSchema.safeParse(body);

  if (!envelope.success) {
    throw new AppError({
      code: ERROR_CODE.UNKNOWN,
      message: 'Malformed response from the server',
      status: 200,
    });
  }

  const failure = businessError(body);
  if (failure) throw failure;

  const parsed = schema.safeParse(envelope.data.data);
  if (!parsed.success) {
    // The contract drifted. Fail loudly here rather than letting `undefined`
    // surface three layers up inside a component.
    throw new AppError({
      code: ERROR_CODE.UNKNOWN,
      message: `Unexpected response shape: ${parsed.error.issues
        .map((issue) => `${issue.path.join('.') || '(root)'} ${issue.message}`)
        .join('; ')}`,
      status: 200,
    });
  }

  return parsed.data;
}

/** `unwrap` for list endpoints, keeping `meta.pagination` alongside the items. */
export function unwrapPaginated<S extends z.ZodTypeAny>(
  body: unknown,
  itemSchema: S
): Paginated<z.infer<S>> {
  const envelope = ApiEnvelopeSchema.safeParse(body);
  const pagination = envelope.success
    ? (envelope.data.meta?.pagination as ApiPagination | undefined)
    : undefined;

  // A list endpoint may legitimately return `data: null` when empty.
  const items = (unwrap(body, itemSchema.array().nullish()) ?? []) as z.infer<S>[];

  return { items, pagination };
}
