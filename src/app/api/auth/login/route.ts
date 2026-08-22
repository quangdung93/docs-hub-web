import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

import { failureEnvelope, successEnvelope } from '@/core/api/errors';
import { endpoints } from '@/core/api/endpoints';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  accessCookieOptions,
  refreshCookieOptions,
} from '@/core/auth/cookies';
import { serverEnv } from '@/core/config/env';
import { LoginResultDtoSchema } from '@/features/auth/api/auth.dto';
import { LoginInputSchema } from '@/features/auth/schemas/login.schema';

/**
 * Login — the token boundary. The browser posts credentials here (never to the
 * backend directly); this handler exchanges them for a token and writes it into
 * an httpOnly cookie, returning only the safe user object. Tokens never touch JS.
 *
 * The backend returns a short-lived access token plus a `refresh_token`; both go
 * into httpOnly cookies here, and the middleware renews them silently. A backend
 * build that omits the refresh token still works — the session simply ends when
 * the access token expires.
 */
export async function POST(req: NextRequest) {
  const input = LoginInputSchema.safeParse(await req.json().catch(() => null));
  if (!input.success) {
    return NextResponse.json(failureEnvelope('REQ_400', 'Invalid credentials payload'), {
      status: 400,
    });
  }

  const upstream = await fetch(`${serverEnv.API_URL}${endpoints.auth.login}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    // The backend authenticates on `username`, which carries the email.
    body: JSON.stringify({ username: input.data.email, password: input.data.password }),
    cache: 'no-store',
  }).catch(() => null);

  if (!upstream) {
    return NextResponse.json(failureEnvelope('ERR_UPSTREAM', 'Auth service unreachable'), {
      status: 502,
    });
  }

  const body: unknown = await upstream.json().catch(() => null);

  // Forward both transport failures (4xx/5xx) and business failures, which the
  // backend reports as HTTP 200 with `success:false`.
  const envelope = body as {
    success?: boolean;
    error?: { code?: string; message?: string };
  } | null;
  if (!upstream.ok || envelope?.success === false) {
    return NextResponse.json(body ?? failureEnvelope('AUTH_401', 'Authentication failed'), {
      status: upstream.ok ? 200 : upstream.status,
    });
  }

  const parsed = LoginResultDtoSchema.safeParse(
    body && typeof body === 'object' && 'data' in body ? body.data : body
  );
  if (!parsed.success) {
    return NextResponse.json(failureEnvelope('ERR_CONTRACT', 'Malformed auth response'), {
      status: 502,
    });
  }

  const { user, token, refresh_token: refreshToken } = parsed.data;
  const jar = await cookies();
  jar.set(ACCESS_COOKIE, token, accessCookieOptions());
  if (refreshToken) jar.set(REFRESH_COOKIE, refreshToken, refreshCookieOptions());

  return NextResponse.json(
    successEnvelope({
      user: {
        id: user.id,
        email: user.username,
        name: user.full_name ?? user.username,
        roles: user.roles,
      },
    })
  );
}
