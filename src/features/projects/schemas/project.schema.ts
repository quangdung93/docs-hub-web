import { z } from 'zod';

/**
 * Project contracts. Zod is the source of truth: the API layer parses responses
 * with these, MSW builds its fixtures from them, and every TS type below is
 * inferred — so a backend field rename fails loudly in one place.
 */
export const ProjectStatusSchema = z.enum(['active', 'archived']);

export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  status: ProjectStatusSchema,
  imageUrl: z.string().nullable().default(null),
  documentCount: z.number().int().nonnegative(),
  memberCount: z.number().int().nonnegative(),
  chunkCount: z.number().int().nonnegative(),
  ownerName: z.string(),
  createdAt: z.iso.datetime(),
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

export const ProjectMemberSchema = z.object({
  id: z.string(),
  name: z.string(),
  jobTitle: z.string(),
  role: MemberRoleSchema,
  joinedAt: z.iso.datetime().nullable(),
});

export const ProjectMemberListSchema = z.array(ProjectMemberSchema);

/** Per-project RAG + security configuration (the "Cấu hình" tab). */
export const ProjectSettingsSchema = z.object({
  completionModel: z.string(),
  embeddingModel: z.string(),
  topK: z.number().int().positive(),
  chunkSize: z.number().int().positive(),
  chunkOverlap: z.number().int().nonnegative(),
  allowedFormats: z.array(z.string()),
  auditLog: z.boolean(),
  membersOnly: z.boolean(),
  allowExport: z.boolean(),
});

export type Project = z.infer<typeof ProjectSchema>;
export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;
export type CreateProjectInput = z.infer<typeof CreateProjectInputSchema>;
export type UpdateProjectInput = z.infer<typeof UpdateProjectInputSchema>;
export type ProjectMember = z.infer<typeof ProjectMemberSchema>;
export type MemberRole = z.infer<typeof MemberRoleSchema>;
export type ProjectSettings = z.infer<typeof ProjectSettingsSchema>;
