import { z } from 'zod';

/**
 * Auth contract (mock-first, we define it). Zod is the source of truth; the MSW
 * auth handlers build responses from these same schemas so mock and app agree.
 */

/** Roles are opaque strings here; the role→permission map lives in Module 5. */
export const UserSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  name: z.string().min(1),
  roles: z.array(z.string()).default([]),
});
export type User = z.infer<typeof UserSchema>;

/** Claims carried inside the signed access-token JWT. */
export const SessionClaimsSchema = z.object({
  sub: z.uuid(),
  email: z.email(),
  name: z.string(),
  roles: z.array(z.string()).default([]),
  /** Bumped by the backend on role change so refresh invalidates stale grants. */
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
    name: claims.name,
    roles: claims.roles,
    permVersion: claims.permVersion,
  };
}
