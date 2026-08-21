import { z } from 'zod';

/**
 * Wire contracts for the docs-hub-api document module.
 *
 * The backend models a document as an identity (`title`, `description`) that owns
 * an ordered list of **revisions**. Everything the UI treats as "the document" —
 * file name, size, MIME type, ingestion status — actually lives on a revision.
 * The mapper flattens document + newest revision into the flat domain model the
 * table renders; this file keeps the raw two-level shape.
 *
 * Verified against https://api.docshub.io.vn on 21/08/2026.
 */

/** Which project version (or change request) a revision belongs to. */
export const ScopeDtoSchema = z.object({
  project_version_id: z.string().nullish(),
  change_request_id: z.string().nullish(),
});

export const DocumentDtoSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  title: z.string(),
  description: z.string().nullish(),
  document_key: z.string().nullish(),
  created_by: z.string().nullish(),
  created_at: z.string(),
  updated_at: z.string(),
  /** Optimistic-locking counter — PATCH echoes it back and rejects a stale one. */
  version: z.number().int(),
});

/**
 * `status` is typed as a bare string by the backend, so it is NOT an enum here:
 * an unknown value must not blow up the whole list. The mapper narrows it.
 */
export const RevisionDtoSchema = z.object({
  id: z.string(),
  document_id: z.string(),
  project_id: z.string(),
  revision_no: z.number().int(),
  file_name: z.string(),
  media_type: z.string(),
  size_bytes: z.number().int().nonnegative(),
  sha256: z.string(),
  status: z.string(),
  error_code: z.string().nullish(),
  error_detail: z.string().nullish(),
  scope: ScopeDtoSchema.nullish(),
  /** RAGFlow ingestion mirror — the source of "still embedding" in the UI. */
  ragflow_sync_status: z.string().nullish(),
  ragflow_last_error: z.string().nullish(),
  ragflow_synced_at: z.string().nullish(),
  created_by: z.string().nullish(),
  created_at: z.string(),
  updated_at: z.string(),
});

/** `POST .../uploads` and `.../revisions` both answer 202 with this pair. */
export const UploadResponseDtoSchema = z.object({
  document: DocumentDtoSchema,
  revision: RevisionDtoSchema,
});

export const DocumentDetailDtoSchema = z.object({
  document: DocumentDtoSchema,
  revisions: z.array(RevisionDtoSchema).nullish(),
});

export const PresignResultDtoSchema = z.object({
  upload_id: z.string(),
  object_key: z.string(),
  upload_url: z.string(),
  expires_at: z.string(),
});

export const ProjectVersionDtoSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  label: z.string(),
  sequence_no: z.number().int(),
  status: z.string(),
  released_at: z.string().nullish(),
  created_by: z.string().nullish(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const DocumentListDtoSchema = z.array(DocumentDtoSchema);
export const ProjectVersionListDtoSchema = z.array(ProjectVersionDtoSchema);

export type DocumentDto = z.infer<typeof DocumentDtoSchema>;
export type RevisionDto = z.infer<typeof RevisionDtoSchema>;
export type UploadResponseDto = z.infer<typeof UploadResponseDtoSchema>;
export type DocumentDetailDto = z.infer<typeof DocumentDetailDtoSchema>;
export type PresignResultDto = z.infer<typeof PresignResultDtoSchema>;
export type ProjectVersionDto = z.infer<typeof ProjectVersionDtoSchema>;
