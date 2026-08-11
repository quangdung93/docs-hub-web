import { z } from 'zod';

/**
 * Wire contracts for the auth module.
 *
 * `roles` arrives as a **raw JSON string** (e.g. `"[\"admin\"]"`), not an array —
 * documented backend behaviour. Parsing it here keeps that quirk at the edge, so
 * nothing downstream has to know about it. A malformed value degrades to an empty
 * list rather than breaking sign-in.
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

export const LoginResultDtoSchema = z.object({
  user: AuthUserDtoSchema,
  token: z.string(),
});

export type AuthUserDto = z.infer<typeof AuthUserDtoSchema>;
export type LoginResultDto = z.infer<typeof LoginResultDtoSchema>;
