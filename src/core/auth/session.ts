import 'server-only';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';

import { ACCESS_COOKIE } from './cookies';
import { verifyAccessToken } from './jwt';
import { claimsToSession, type Session } from './tokens';

/**
 * The authoritative session read for server components and server actions.
 * Verifies the access-token JWT locally (no network hop) and is wrapped in React
 * `cache()` so N components in one request verify exactly once. Middleware keeps
 * the cookie fresh, so RSC never has to deal with expiry here.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) return null;
  const claims = await verifyAccessToken(token);
  return claims ? claimsToSession(claims) : null;
});

/** Require an authenticated session in an RSC; redirect to /login otherwise. */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect('/login');
  return session;
}
