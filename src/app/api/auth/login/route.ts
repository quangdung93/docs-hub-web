import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

import { failureEnvelope, successEnvelope } from '@/core/api/errors';

import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  accessCookieOptions,
  refreshCookieOptions,
} from '@/core/auth/cookies';
import { AuthResultSchema } from '@/core/auth/tokens';
import { serverEnv } from '@/core/config/env';
import { LoginInputSchema } from '@/features/auth/schemas/login.schema';

/**
 * Login — the token boundary. The browser posts credentials here (never to the
 * backend directly); this handler exchanges them for tokens and writes them into
 * httpOnly cookies, returning only the safe user object. Tokens never touch JS.
 */
export async function POST(req: NextRequest) {
  const input = LoginInputSchema.safeParse(await req.json().catch(() => null));
  if (!input.success) {
    return NextResponse.json(failureEnvelope('ERR_VALIDATION', 'Invalid credentials payload'), {
      status: 400,
    });
  }

  const upstream = await fetch(`${serverEnv.API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input.data),
    cache: 'no-store',
  }).catch(() => null);

  if (!upstream) {
    return NextResponse.json(failureEnvelope('ERR_UPSTREAM', 'Auth service unreachable'), {
      status: 502,
    });
  }

  const body: unknown = await upstream.json().catch(() => null);
  if (!upstream.ok) {
    return NextResponse.json(body ?? failureEnvelope('ERR_AUTH', 'Authentication failed'), {
      status: upstream.status,
    });
  }

  const data = body && typeof body === 'object' && 'data' in body ? body.data : body;
  const parsed = AuthResultSchema.safeParse(data);
  if (!parsed.success) {
    return NextResponse.json(failureEnvelope('ERR_CONTRACT', 'Malformed auth response'), {
      status: 502,
    });
  }

  const { user, accessToken, refreshToken } = parsed.data;
  const jar = await cookies();
  jar.set(ACCESS_COOKIE, accessToken, accessCookieOptions());
  jar.set(REFRESH_COOKIE, refreshToken, refreshCookieOptions());

  return NextResponse.json(successEnvelope({ user }));
}
