import { z } from 'zod';

/**
 * Wire contracts for docs-hub-api, kept separate from the app's own models.
 *
 * The backend speaks snake_case and exposes fields the UI does not use (and
 * omits several the UI shows). Keeping the raw shape here — and mapping to the
 * domain model in one place — means a backend rename touches this file only,
 * and the components never learn what the wire looks like.
 */
export const ProjectSettingsDtoSchema = z.object({
  model: z.string().nullish(),
  top_k: z.number().nullish(),
  chunk_size: z.number().nullish(),
  allowed_formats: z.array(z.string()).nullish(),
});

export const ProjectDtoSchema = z.object({
  id: z.string(),
  owner_id: z.string(),
  name: z.string(),
  description: z.string().nullish(),
  status: z.string(),
  settings: ProjectSettingsDtoSchema.nullish(),
  /** Presigned GET URL — expires, so it is never cached beyond the render. */
  avatar_url: z.string().nullish(),
  /** Present on `GET /projects` and `GET /projects/{id}`; absent on write responses. */
  document_count: z.number().int().nullish(),
  member_count: z.number().int().nullish(),
  chunk_count: z.number().int().nullish(),
  created_at: z.string(),
});

/**
 * `user` was added by the backend on 25/08/2026 — before that a member row
 * carried `user_id` only and the table had no name to show. It stays optional so
 * a rollback on either side degrades to the id instead of failing the parse.
 */
export const ProjectMemberDtoSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  user_id: z.string(),
  role: z.enum(['owner', 'editor', 'viewer']),
  status: z.enum(['pending', 'active']),
  invited_at: z.string(),
  joined_at: z.string().nullish(),
  user: z
    .object({
      id: z.string(),
      full_name: z.string().nullish(),
      email: z.string().nullish(),
    })
    .nullish(),
});

export const AvatarUploadUrlDtoSchema = z.object({
  upload_url: z.string(),
  expires_at: z.string(),
});

export type ProjectDto = z.infer<typeof ProjectDtoSchema>;
export type ProjectMemberDto = z.infer<typeof ProjectMemberDtoSchema>;
export type AvatarUploadUrlDto = z.infer<typeof AvatarUploadUrlDtoSchema>;
