import 'server-only';

import { cookies } from 'next/headers';

import { serverEnv } from '@/core/config/env';

import { AppError, ApiFailureSchema, ERROR_CODE } from './errors';

/**
 * Server-side transport for React Server Components and server actions. Unlike the
 * client (which goes through the BFF proxy), server code talks to the backend
 * DIRECTLY with `fetch`, attaching the access token read from the httpOnly cookie.
 * Using `fetch` (not Axios) keeps us inside Next's caching/dedup and works in every
 * server runtime. The auth cookie name/refresh wiring lands in Module 4; for now
 * this forwards whatever access cookie exists.
 */
const ACCESS_COOKIE = 'access_token';

export async function serverFetch(path: string, init?: RequestInit): Promise<Response> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_COOKIE)?.value;

  const url = `${serverEnv.API_URL}${path.startsWith('/') ? path : `/${path}`}`;

  return fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...init?.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    // Opt out of caching by default; callers pass `next: { revalidate }` to opt in.
    cache: init?.cache ?? 'no-store',
  });
}

/**
 * Fetch + unwrap the `{ success, data }` envelope, returning `data` typed as `T`.
 * Throws AppError on transport failure or a `success:false` body so RSC error
 * boundaries handle it uniformly.
 */
export async function serverFetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await serverFetch(path, init);
  } catch {
    throw new AppError({
      code: ERROR_CODE.NETWORK,
      message: 'Network error — could not reach the server',
      status: 0,
    });
  }

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const parsed = ApiFailureSchema.safeParse(body);
    if (parsed.success) {
      const { code, message, details } = parsed.data.error;
      throw new AppError({ code, message, status: response.status, details });
    }
    throw new AppError({
      code: ERROR_CODE.UNKNOWN,
      message: `Request failed with status ${response.status}`,
      status: response.status,
    });
  }

  // Success envelope: `{ success: true, data, meta }`.
  if (body && typeof body === 'object' && 'data' in body) {
    return (body as { data: T }).data;
  }
  return body as T;
}
