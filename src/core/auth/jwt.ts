import { decodeJwt, jwtVerify, SignJWT } from 'jose';

import { type SessionClaims, SessionClaimsSchema } from './tokens';

/**
 * JWT sign/verify — HS256 with a shared secret. Pure (jose + Web Crypto), so it
 * runs in both the Edge middleware and Node (route handlers, the MSW mock that
 * mints tokens). Symmetric keys are fine for the mock-first phase; a real backend
 * would sign with its own key and the app would verify via JWKS.
 *
 * The app (verify) and the mock (sign) MUST share this secret, so both resolve it
 * the same way: env `AUTH_SECRET`, else a fixed dev fallback.
 */
const DEV_FALLBACK_SECRET = 'dev-insecure-shared-secret-please-override-32c';
const ISSUER = 'docs-hub-api';
const AUDIENCE = 'docs-hub-web';

export const ACCESS_TTL = '10m';
export const REFRESH_TTL = '14d';

function key(): Uint8Array {
  return new TextEncoder().encode(process.env.AUTH_SECRET || DEV_FALLBACK_SECRET);
}

export async function signAccessToken(claims: SessionClaims): Promise<string> {
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime(ACCESS_TTL)
    .sign(key());
}

export async function signRefreshToken(sub: string): Promise<string> {
  return new SignJWT({ typ: 'refresh' })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(sub)
    .setExpirationTime(REFRESH_TTL)
    .sign(key());
}

/**
 * Read the claims out of the access token, or null if it is malformed/expired.
 *
 * This DECODES rather than verifies the signature, deliberately. The token is
 * minted and signed by docs-hub-api with a secret this app does not hold (and
 * should not — it is the backend's). Verifying it here with `AUTH_SECRET` would
 * fail every real token.
 *
 * That is safe because this value is not a trust boundary: the token arrives from
 * our own httpOnly cookie (JS cannot write it) and is only used to render the
 * current user and gate navigation. Every actual authorization decision is made
 * by the backend, which validates the signature on each request. `exp` is still
 * enforced so an expired session logs out instead of showing a stale identity.
 *
 * If the backend later exposes a JWKS endpoint, swap the body for `jwtVerify`
 * against that key set.
 */
export async function verifyAccessToken(token: string): Promise<SessionClaims | null> {
  try {
    const payload = decodeJwt(token);
    if (payload.iss && payload.iss !== ISSUER) return null;
    if (payload.exp && payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return SessionClaimsSchema.parse(payload);
  } catch {
    return null;
  }
}

/** Verify a refresh token, returning its subject (user id) or null. */
export async function verifyRefreshToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, key(), { issuer: ISSUER, audience: AUDIENCE });
    return payload.typ === 'refresh' && typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

/**
 * True if the access token expires within `withinSeconds` (or is already invalid).
 * Decodes rather than verifies, for the same reason as `verifyAccessToken`.
 */
export async function isAccessExpiring(token: string, withinSeconds = 60): Promise<boolean> {
  try {
    const payload = decodeJwt(token);
    if (!payload.exp) return true;
    return payload.exp - Math.floor(Date.now() / 1000) <= withinSeconds;
  } catch {
    return true;
  }
}
