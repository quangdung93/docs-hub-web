import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { successEnvelope } from '@/core/api/errors';

import { ACCESS_COOKIE, REFRESH_COOKIE, clearCookieOptions } from '@/core/auth/cookies';
import { serverEnv } from '@/core/config/env';

/**
 * Logout — clear both auth cookies and best-effort revoke on the backend. Always
 * returns success from the client's point of view: a failed upstream revoke must
 * not leave the user with cookies they can't clear.
 */
export async function POST() {
  const jar = await cookies();
  const refreshToken = jar.get(REFRESH_COOKIE)?.value;

  if (refreshToken) {
    await fetch(`${serverEnv.API_URL}/auth/logout`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store',
    }).catch(() => null);
  }

  jar.set(ACCESS_COOKIE, '', clearCookieOptions());
  jar.set(REFRESH_COOKIE, '', clearCookieOptions());

  return NextResponse.json(successEnvelope({ ok: true }));
}
