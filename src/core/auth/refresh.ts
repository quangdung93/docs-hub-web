import { serverEnv } from '@/core/config/env';

import { type TokenPair, TokenPairSchema } from './tokens';

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

async function doRefresh(refreshToken: string): Promise<TokenPair | null> {
  try {
    const res = await fetch(`${serverEnv.API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store',
    });
    if (!res.ok) return null;

    const body: unknown = await res.json().catch(() => null);
    const data =
      body && typeof body === 'object' && 'data' in body ? (body as { data: unknown }).data : body;

    const parsed = TokenPairSchema.safeParse(data);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
