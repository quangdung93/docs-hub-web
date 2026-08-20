import { z } from 'zod';

/**
 * Auth contract (mock-first, we define it). Zod is the source of truth; the MSW
 * auth handlers build responses from these same schemas so mock and app agree.
 */

/**
 * Roles are opaque strings here; the role→permission map lives in Module 5.
 *
 * `email` is NOT `z.email()`: it carries the backend's `username`, which is a
 * login identifier that only usually looks like an email. The seeded account is
 * `admin@local` — no TLD, so a strict email check rejects it and sign-in fails
 * with a valid HTTP 200 response. Verified against the real API.
 */
export const UserSchema = z.object({
  id: z.uuid(),
  email: z.string().min(1),
  name: z.string().min(1),
  roles: z.array(z.string()).default([]),
});
export type User = z.infer<typeof UserSchema>;

/**
 * Claims carried inside the access-token JWT — as docs-hub-api actually mints it:
 *
 *   {user_id, email, roles, iss: "docs-hub-api", sub, exp, iat}
 *
 * Note what is absent: no `aud`, no display name, no permission version. Every
 * field the backend does not send is optional here, so a real token parses.
 */
export const SessionClaimsSchema = z.object({
  sub: z.uuid(),
  // Same reason as UserSchema.email — this is a username, not a validated email.
  email: z.string().min(1),
  /** The backend has no display-name claim; fall back to the username. */
  name: z.string().optional(),
  roles: z.array(z.string()).default([]),
  exp: z.number().int().optional(),
  /** Reserved for Module 5 — the backend does not issue this yet. */
  permVersion: z.number().int().nonnegative().default(0),
});
export type SessionClaims = z.infer<typeof SessionClaimsSchema>;

/** App-facing session (what components/guards consume). */
export interface Session {
  userId: string;
  email: string;
  name: string;
  roles: string[];
  permVersion: number;
}

export const TokenPairSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
});
export type TokenPair = z.infer<typeof TokenPairSchema>;

/** `POST /auth/login` response payload (inside the success envelope). */
export const AuthResultSchema = z.object({
  user: UserSchema,
  accessToken: z.string(),
  refreshToken: z.string(),
});
export type AuthResult = z.infer<typeof AuthResultSchema>;

export function claimsToSession(claims: SessionClaims): Session {
  return {
    userId: claims.sub,
    email: claims.email,
    name: claims.name ?? claims.email,
    roles: claims.roles,
    permVersion: claims.permVersion,
  };
}
