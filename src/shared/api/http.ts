import axios, { type AxiosError, type AxiosInstance } from 'axios';

import { ApiEnvelopeSchema } from '@/core/api/envelope';
import { AppError, ERROR_CODE } from '@/core/api/errors';
import { logError, logRequestStart, logResponse } from './api-log';

/**
 * Client-side transport. Lives in `shared/` (not `core/`) on purpose: Axios is
 * client-only and ESLint bans it from server code. The browser only ever calls
 * the same-origin BFF (`/api/*`) — cookies are attached automatically and the
 * server proxy adds the JWT, so this instance never sees or handles tokens.
 *
 * There is deliberately NO refresh interceptor here: refresh happens server-side
 * (middleware + proxy, Module 4). A 401 that reaches the client means the session
 * is truly dead → hand off to the login page.
 */
/**
 * When the app is mounted under a sub-path (see `basePath` in next.config.ts),
 * Next rewrites its route handlers to live under that prefix too — so the client
 * must call `${basePath}/api`, not `/api`. Inlined at build time by Next.
 */
const apiBaseUrl = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/api`;

export const http: AxiosInstance = axios.create({
  baseURL: apiBaseUrl,
  timeout: 30_000,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

/**
 * FormData must NOT carry the instance-wide JSON content type: multipart needs a
 * `boundary=...` parameter, which only the browser can generate. Deleting the
 * header here lets it set `multipart/form-data; boundary=…` itself. Without this
 * every file upload reaches the server with an unparseable body.
 */
http.interceptors.request.use((config) => {
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  // Feeds the API inspector (floating button). Browser-only: on the server there
  // is no inspector to read it, and the module-level buffer would leak per request.
  if (typeof window !== 'undefined') {
    config.headers['x-api-log-id'] = logRequestStart(config);
  }
  return config;
});

/** The id we stamped on the way out, read back off the echoed request config. */
function logIdOf(config: unknown): string | undefined {
  const headers = (config as { headers?: Record<string, unknown> } | undefined)?.headers;
  const id = headers?.['x-api-log-id'];
  return typeof id === 'string' ? id : undefined;
}

http.interceptors.response.use(
  (response) => {
    if (typeof window !== 'undefined') logResponse(logIdOf(response.config), response);
    return response;
  },
  (error: AxiosError) => {
    if (typeof window !== 'undefined') logError(logIdOf(error.config), error);
    return Promise.reject(normalizeAxiosError(error));
  }
);

/** Map any Axios failure (backend envelope, network, timeout, cancel) to AppError. */
export function normalizeAxiosError(error: AxiosError): AppError {
  if (axios.isCancel(error)) {
    return new AppError({ code: ERROR_CODE.CANCELED, message: 'Request canceled', status: 0 });
  }

  if (error.code === 'ECONNABORTED') {
    return new AppError({ code: ERROR_CODE.TIMEOUT, message: 'Request timed out', status: 0 });
  }

  const response = error.response;
  if (!response) {
    return new AppError({
      code: ERROR_CODE.NETWORK,
      message: 'Network error — could not reach the server',
      status: 0,
    });
  }

  // Prefer the structured envelope when the backend sent one. This is the 4xx/5xx
  // path (technical failures); business failures arrive as HTTP 200 and are
  // handled by `unwrap`, not here.
  const parsed = ApiEnvelopeSchema.safeParse(response.data);
  if (parsed.success && parsed.data.error) {
    const { code, message, details, retryable } = parsed.data.error;
    return new AppError({
      code,
      message,
      status: response.status,
      details: (details ?? undefined) as Record<string, unknown> | undefined,
      retryable: retryable ?? false,
    });
  }

  return new AppError({
    code: ERROR_CODE.UNKNOWN,
    message: error.message || 'Unexpected error',
    status: response.status,
  });
}
