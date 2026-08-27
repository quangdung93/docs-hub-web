import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { failureEnvelope, successEnvelope } from '@/core/api/errors';

import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  accessCookieOptions,
  clearCookieOptions,
  refreshCookieOptions,
} from '@/core/auth/cookies';
import { refreshTokens } from '@/core/auth/refresh';

/**
 * Explicit client-triggered refresh (middleware handles the silent path on
 * navigation). Rotates both cookies on success; clears them on a dead session.
 */
export async function POST() {
  const jar = await cookies();
  const refreshToken = jar.get(REFRESH_COOKIE)?.value;

  if (!refreshToken) {
    return NextResponse.json(failureEnvelope('ERR_NO_SESSION', 'No refresh token'), {
      status: 401,
    });
  }

  const pair = await refreshTokens(refreshToken);
  if (!pair) {
    jar.set(ACCESS_COOKIE, '', clearCookieOptions());
    jar.set(REFRESH_COOKIE, '', clearCookieOptions());
    return NextResponse.json(failureEnvelope('ERR_REFRESH', 'Session expired'), { status: 401 });
  }

  jar.set(ACCESS_COOKIE, pair.accessToken, accessCookieOptions());
  jar.set(REFRESH_COOKIE, pair.refreshToken, refreshCookieOptions());
  return NextResponse.json(successEnvelope({ ok: true }));
}
