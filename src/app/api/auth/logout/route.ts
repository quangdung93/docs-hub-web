import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { endpoints } from '@/core/api/endpoints';
import { successEnvelope } from '@/core/api/errors';

import { ACCESS_COOKIE, REFRESH_COOKIE, clearCookieOptions } from '@/core/auth/cookies';
import { serverEnv } from '@/core/config/env';

/**
 * Logout — clear the auth cookies and best-effort notify the backend. Always
 * returns success from the client's point of view: a failed upstream call must
 * not leave the user with cookies they can't clear.
 *
 * The upstream call is gated on the ACCESS token, not a refresh token: docs-hub-api
 * issues a single bearer token and its logout endpoint authenticates with that.
 * Note it does not actually revoke — the token stays valid until `exp` (verified
 * against the live API) — so clearing the cookie below is what really ends the
 * session here.
 */
export async function POST() {
  const jar = await cookies();
  const accessToken = jar.get(ACCESS_COOKIE)?.value;

  if (accessToken) {
    await fetch(`${serverEnv.API_URL}${endpoints.auth.logout}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    }).catch(() => null);
  }

  jar.set(ACCESS_COOKIE, '', clearCookieOptions());
  jar.set(REFRESH_COOKIE, '', clearCookieOptions());

  return NextResponse.json(successEnvelope({ ok: true }));
}
