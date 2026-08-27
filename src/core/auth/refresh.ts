import { endpoints } from '@/core/api/endpoints';
import { serverEnv } from '@/core/config/env';
import { RefreshResultDtoSchema } from '@/features/auth/api/auth.dto';

import { type TokenPair } from './tokens';

/**
 * Single-flight token refresh. Concurrent callers holding the same refresh token
 * (multiple tabs, parallel requests, middleware + proxy) share ONE in-flight call
 * per instance, so we don't fire N refreshes and clobber each other's rotation.
 *
 * Cross-instance safety comes from the backend contract, not this map: replaying a
 * refresh token within a short grace window must return the SAME new pair. The map
 * is cleared shortly after settling so a later legitimate refresh isn't blocked.
 */
const inflight = new Map<string, Promise<TokenPair | null>>();

export function refreshTokens(refreshToken: string): Promise<TokenPair | null> {
  const existing = inflight.get(refreshToken);
  if (existing) return existing;

  const promise = doRefresh(refreshToken).finally(() => {
    setTimeout(() => inflight.delete(refreshToken), 5_000);
  });
  inflight.set(refreshToken, promise);
  return promise;
}

/**
 * Exchange a refresh token for a fresh pair. The backend speaks snake_case here
 * (`refresh_token` in and out, access token under `token`) and rotates on every
 * call — the old refresh token is revoked immediately, so the caller MUST store
 * the returned one or the next refresh fails.
 */
async function doRefresh(refreshToken: string): Promise<TokenPair | null> {
  try {
    const res = await fetch(`${serverEnv.API_URL}${endpoints.auth.refresh}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: 'no-store',
    });
    if (!res.ok) return null;

    const body: unknown = await res.json().catch(() => null);
    // A business failure arrives as HTTP 200 with `success:false`; treat it as a
    // dead session rather than parsing a `data` that isn't there.
    if (body && typeof body === 'object' && (body as { success?: boolean }).success === false) {
      return null;
    }

    const data =
      body && typeof body === 'object' && 'data' in body ? (body as { data: unknown }).data : body;

    const parsed = RefreshResultDtoSchema.safeParse(data);
    if (!parsed.success) return null;

    // No new refresh token means rotation is off; keep using the current one so
    // the session survives instead of dying on the next renewal.
    return {
      accessToken: parsed.data.token,
      refreshToken: parsed.data.refresh_token ?? refreshToken,
    };
  } catch {
    return null;
  }
}
