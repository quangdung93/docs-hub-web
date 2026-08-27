import { z } from 'zod';

/**
 * Wire contracts for the auth module.
 *
 * `roles` historically arrived as a raw JSON string (`"[\"admin\"]"`) and now
 * arrives as a real array. Both are accepted so a rollback on either side cannot
 * break sign-in; a malformed value degrades to an empty list.
 */
const RolesSchema = z
  .union([z.string(), z.array(z.string())])
  .nullish()
  .transform((value) => {
    if (Array.isArray(value)) return value;
    if (typeof value !== 'string') return [];
    try {
      const parsed: unknown = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  });

export const AuthUserDtoSchema = z.object({
  id: z.string(),
  username: z.string(),
  full_name: z.string().nullish(),
  roles: RolesSchema,
  created_at: z.string().nullish(),
});

/**
 * `POST /auth/login` and `POST /auth/refresh` return the same token payload:
 * a short-lived access `token` plus the `refresh_token` that renews it.
 * `refresh_token` stays optional so the app still works against a backend build
 * that predates it — the user just signs in again when the access token expires.
 */
export const LoginResultDtoSchema = z.object({
  user: AuthUserDtoSchema,
  token: z.string(),
  refresh_token: z.string().nullish(),
  expires_in: z.number().int().nullish(),
});

/** `POST /auth/refresh` — same tokens, without the user object. */
export const RefreshResultDtoSchema = z.object({
  token: z.string(),
  refresh_token: z.string().nullish(),
  expires_in: z.number().int().nullish(),
});

export type AuthUserDto = z.infer<typeof AuthUserDtoSchema>;
export type LoginResultDto = z.infer<typeof LoginResultDtoSchema>;
export type RefreshResultDto = z.infer<typeof RefreshResultDtoSchema>;
