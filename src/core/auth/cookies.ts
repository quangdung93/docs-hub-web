/**
 * Auth cookie policy in one place (read by the proxy, route handlers, and
 * middleware). Both tokens are httpOnly + SameSite=Lax + secure (in prod), so JS
 * can never read them. The refresh cookie stays at `path=/` (not `/api/auth`) on
 * purpose: middleware must read it to silently refresh during navigation. Scoping
 * it to `/api/auth` is a valid hardening if middleware refresh is ever dropped.
 */
export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';

const isProd = process.env.NODE_ENV === 'production';
// 15m — matches the backend's access-token lifetime (`expires_in: 900`). The
// cookie must not expire BEFORE the token it carries: a shorter window drops the
// session while the token is still valid, forcing a sign-in the refresh flow
// could have avoided.
const ACCESS_MAX_AGE = 60 * 15;
const REFRESH_MAX_AGE = 60 * 60 * 24 * 14; // 14d — matches REFRESH_TTL

interface CookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax' | 'strict' | 'none';
  path: string;
  maxAge: number;
}

export function accessCookieOptions(): CookieOptions {
  return { httpOnly: true, secure: isProd, sameSite: 'lax', path: '/', maxAge: ACCESS_MAX_AGE };
}

export function refreshCookieOptions(): CookieOptions {
  return { httpOnly: true, secure: isProd, sameSite: 'lax', path: '/', maxAge: REFRESH_MAX_AGE };
}

/** Options for clearing a cookie (maxAge 0). */
export function clearCookieOptions(): CookieOptions {
  return { httpOnly: true, secure: isProd, sameSite: 'lax', path: '/', maxAge: 0 };
}
