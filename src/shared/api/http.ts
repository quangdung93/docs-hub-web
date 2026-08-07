import axios, { type AxiosError, type AxiosInstance } from 'axios';

import { AppError, ApiFailureSchema, ERROR_CODE } from '@/core/api/errors';

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

http.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => Promise.reject(normalizeAxiosError(error))
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

  // Prefer the structured `success:false` envelope when the backend sent one.
  const parsed = ApiFailureSchema.safeParse(response.data);
  if (parsed.success) {
    const { code, message, details } = parsed.data.error;
    return new AppError({ code, message, status: response.status, details });
  }

  return new AppError({
    code: ERROR_CODE.UNKNOWN,
    message: error.message || 'Unexpected error',
    status: response.status,
  });
}
