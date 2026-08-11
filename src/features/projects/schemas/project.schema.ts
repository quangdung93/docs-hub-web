import { z } from 'zod';

/**
 * Project contracts. Zod is the source of truth: the API layer parses responses
 * with these, MSW builds its fixtures from them, and every TS type below is
 * inferred — so a backend field rename fails loudly in one place.
 */
export const ProjectStatusSchema = z.enum(['active', 'archived']);

/**
 * Domain model for a project.
 *
 * Several fields are nullable because docs-hub-api does not provide them yet:
 * the counters and `ownerName` are not on ProjectResponse. Null means "unknown",
 * and the UI renders a placeholder rather than a misleading zero — do NOT
 * default these to 0/'' in the mapper.
 */
export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  status: ProjectStatusSchema,
  imageUrl: z.string().nullable(),
  ownerId: z.string(),
  ownerName: z.string().nullable(),
  documentCount: z.number().int().nonnegative().nullable(),
  memberCount: z.number().int().nonnegative().nullable(),
  chunkCount: z.number().int().nonnegative().nullable(),
  createdAt: z.string(),
});

export const ProjectListSchema = z.array(ProjectSchema);

/**
 * Create-project wizard step 1. Step 2 (documents) uploads separately.
 *
 * `description` has no `.default()` on purpose: the form supplies its own
 * `defaultValues`, and keeping input/output types identical avoids the
 * `useForm<T>` input-vs-output type split that `.default()` introduces.
 */
export const CreateProjectInputSchema = z.object({
  name: z.string().trim().min(1, 'createProject.error.nameRequired').max(120),
  description: z.string().trim().max(500),
});

export const UpdateProjectInputSchema = CreateProjectInputSchema.extend({
  status: ProjectStatusSchema,
});

export const MemberRoleSchema = z.enum(['owner', 'editor', 'viewer', 'pending']);

/** `name`/`jobTitle` are null until the backend joins user identity into the
 *  member list (today it returns `user_id` only). */
export const ProjectMemberSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string().nullable(),
  jobTitle: z.string().nullable(),
  role: MemberRoleSchema,
  joinedAt: z.string().nullable(),
});

export const ProjectMemberListSchema = z.array(ProjectMemberSchema);

/** Per-project RAG + security configuration (the "Cấu hình" tab). */
/** Nullable fields are ones docs-hub-api does not expose yet; the settings panel
 *  marks them unavailable rather than showing an editable fake value. */
export const ProjectSettingsSchema = z.object({
  completionModel: z.string().nullable(),
  topK: z.number().int().positive().nullable(),
  chunkSize: z.number().int().positive().nullable(),
  allowedFormats: z.array(z.string()).nullable(),
  embeddingModel: z.string().nullable(),
  chunkOverlap: z.number().int().nonnegative().nullable(),
  auditLog: z.boolean().nullable(),
  membersOnly: z.boolean().nullable(),
  allowExport: z.boolean().nullable(),
});

export type Project = z.infer<typeof ProjectSchema>;
export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;
export type CreateProjectInput = z.infer<typeof CreateProjectInputSchema>;
export type UpdateProjectInput = z.infer<typeof UpdateProjectInputSchema>;
export type ProjectMember = z.infer<typeof ProjectMemberSchema>;
export type MemberRole = z.infer<typeof MemberRoleSchema>;
export type ProjectSettings = z.infer<typeof ProjectSettingsSchema>;
