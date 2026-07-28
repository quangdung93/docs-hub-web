import { type NextRequest, NextResponse } from 'next/server';

import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  accessCookieOptions,
  clearCookieOptions,
  refreshCookieOptions,
} from '@/core/auth/cookies';
import { isAccessExpiring } from '@/core/auth/jwt';
import { refreshTokens } from '@/core/auth/refresh';

/**
 * Silent refresh on navigation. RSC can't set cookies, but middleware can — so
 * this is where the access token is rotated when it's about to expire. On success
 * it mutates the REQUEST cookies too, so the downstream RSC render in this same
 * request already sees the fresh token (no one-render "logged out" flicker).
 *
 * Route gating (redirect unauthenticated → /login by permission) is layered on in
 * Module 5; for now this only keeps a live session alive. `/api/*` is excluded via
 * the matcher — the BFF proxy does its own refresh.
 */
export async function middleware(req: NextRequest) {
  const access = req.cookies.get(ACCESS_COOKIE)?.value;
  const refresh = req.cookies.get(REFRESH_COOKIE)?.value;

  // Nothing to refresh, or the access token is still comfortably valid.
  if (!refresh) return NextResponse.next();
  if (access && !(await isAccessExpiring(access, 60))) return NextResponse.next();

  const pair = await refreshTokens(refresh);

  if (!pair) {
    const res = NextResponse.next();
    res.cookies.set(ACCESS_COOKIE, '', clearCookieOptions());
    res.cookies.set(REFRESH_COOKIE, '', clearCookieOptions());
    return res;
  }

  // Make the rotated token visible to THIS request's RSC render…
  req.cookies.set(ACCESS_COOKIE, pair.accessToken);
  const res = NextResponse.next({ request: { headers: req.headers } });
  // …and persist both to the browser for subsequent requests.
  res.cookies.set(ACCESS_COOKIE, pair.accessToken, accessCookieOptions());
  res.cookies.set(REFRESH_COOKIE, pair.refreshToken, refreshCookieOptions());
  return res;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
