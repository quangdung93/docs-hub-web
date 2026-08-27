import { http, HttpResponse } from 'msw';

import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from '../../core/auth/jwt';
import type { SessionClaims } from '../../core/auth/tokens';
import { envelope, failure } from '../lib/envelope';

/**
 * Seeded users for the mock backend. The mock signs REAL JWTs (shared secret with
 * the app via AUTH_SECRET), so `getSession()`'s jose verification succeeds against
 * tokens minted here — the whole auth loop works with no real backend.
 */
const USERS = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'admin@docs-hub.local',
    password: 'Password123!',
    name: 'Admin User',
    roles: ['admin'],
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    email: 'editor@docs-hub.local',
    password: 'Password123!',
    name: 'Editor User',
    roles: ['editor'],
  },
] as const;

type SeedUser = (typeof USERS)[number];

const publicUser = (u: SeedUser) => ({
  id: u.id,
  email: u.email,
  name: u.name,
  roles: [...u.roles],
});
const claimsFor = (u: SeedUser): SessionClaims => ({
  sub: u.id,
  email: u.email,
  name: u.name,
  roles: [...u.roles],
  permVersion: 0,
});

export const authHandlers = [
  http.post('*/public/api/v1/auth/login', async ({ request }) => {
    const { username, password } = (await request.json().catch(() => ({}))) as {
      username?: string;
      password?: string;
    };
    const user = USERS.find((u) => u.email === username && u.password === password);
    if (!user) {
      return HttpResponse.json(failure('AUTH_401', 'Sai tên đăng nhập hoặc mật khẩu'), {
        status: 401,
      });
    }
    // `roles` is a raw JSON string on the wire, matching the documented backend
    // behaviour the DTO layer parses back into an array.
    return HttpResponse.json(
      envelope({
        user: {
          id: user.id,
          username: user.email,
          full_name: user.name,
          roles: JSON.stringify([...user.roles]),
          created_at: new Date().toISOString(),
        },
        token: await signAccessToken(claimsFor(user)),
      })
    );
  }),

  http.post('*/internal/api/v1/auth/refresh', async ({ request }) => {
    const { refreshToken } = (await request.json().catch(() => ({}))) as { refreshToken?: string };
    const sub = refreshToken ? await verifyRefreshToken(refreshToken) : null;
    const user = sub ? USERS.find((u) => u.id === sub) : undefined;
    if (!user) {
      return HttpResponse.json(failure('ERR_REFRESH', 'Invalid or expired refresh token'), {
        status: 401,
      });
    }
    // Rotation: issue a fresh pair. A real backend also enforces reuse detection
    // and a short grace window; the app's single-flight relies on that contract.
    return HttpResponse.json(
      envelope({
        accessToken: await signAccessToken(claimsFor(user)),
        refreshToken: await signRefreshToken(user.id),
      })
    );
  }),

  http.post('*/internal/api/v1/auth/logout', () => HttpResponse.json(envelope({ ok: true }))),

  http.get('*/internal/api/v1/auth/me', async ({ request }) => {
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    const claims = token ? await verifyAccessToken(token) : null;
    const user = claims ? USERS.find((u) => u.id === claims.sub) : undefined;
    if (!user) {
      return HttpResponse.json(failure('ERR_UNAUTHENTICATED', 'No valid session'), { status: 401 });
    }
    return HttpResponse.json(envelope(publicUser(user)));
  }),
];
