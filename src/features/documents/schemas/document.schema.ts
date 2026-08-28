import { z } from 'zod';

/**
 * Document contracts. `status` drives the badge colour, the upload-queue row and
 * the list filter, so it is a single enum rather than three parallel booleans.
 */
export const DocumentStatusSchema = z.enum(['indexed', 'processing', 'queued', 'failed']);

/**
 * One entry in a document's change history — a single upload of that document.
 * `revisionNo` is what the user thinks of as the document's version (v1 → v2),
 * distinct from the *project* version the upload was scoped to.
 */
export const RevisionEntrySchema = z.object({
  id: z.string(),
  revisionNo: z.number().int(),
  fileName: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  status: z.enum(['indexed', 'processing', 'queued', 'failed']),
  projectVersionId: z.string().nullable(),
  uploadedBy: z.string().nullable(),
  uploadedAt: z.iso.datetime(),
});

export const DocumentSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** Human format summary, e.g. "PDF · 24 pages". */
  format: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  /** Null until indexing finishes. */
  chunkCount: z.number().int().nonnegative().nullable(),
  status: DocumentStatusSchema,
  updatedAt: z.iso.datetime(),
  /**
   * Newest revision of this document. The backend keeps file-level facts on the
   * revision, and every per-file action (download, view, retry, status poll)
   * addresses it by id — so the table row needs it to offer those actions.
   * Null only for a document whose revisions were not included in the response.
   */
  revisionId: z.string().nullable(),
  revisionNo: z.number().int().nullable(),
  /** Reason for `status: 'failed'`, straight from the ingestion worker. */
  errorMessage: z.string().nullable(),
  /**
   * Name of the underlying file, which is NOT the display name: the backend lets
   * a user title a document freely, so the title often has no extension. Icons
   * and the format filter key off this.
   */
  fileName: z.string().nullable(),
  /** Optimistic-locking counter; PATCH must echo the value it last read. */
  version: z.number().int(),
  /**
   * Project version the newest revision was uploaded into, from
   * `revision.scope.project_version_id`. Null when the revision carries no scope
   * (older rows) or the list response omitted revisions entirely — the table
   * shows a dash rather than guessing the current version.
   */
  projectVersionId: z.string().nullable(),
  /**
   * Every revision, newest first. This is the document's change history: the
   * backend has no history endpoint, but `GET /documents/{id}` already returns
   * the full revision list, so the history tab is built from data the table has
   * already fetched rather than from a second round trip.
   */
  history: z.array(RevisionEntrySchema),
});

export const DocumentListSchema = z.array(DocumentSchema);

export type Document = z.infer<typeof DocumentSchema>;
export type RevisionEntry = z.infer<typeof RevisionEntrySchema>;
export type DocumentStatus = z.infer<typeof DocumentStatusSchema>;

/**
 * Format filter buckets. Keyed on the file extension rather than the `format`
 * display string, which is prose ("Word · 6 trang") and would break the filter the
 * moment the backend localises it. `doc`/`docx` and `xls`/`xlsx` collapse into one
 * bucket because users think in applications, not extensions.
 */
export const DOCUMENT_FORMATS = {
  pdf: ['pdf'],
  word: ['doc', 'docx'],
  excel: ['xls', 'xlsx'],
  csv: ['csv'],
  markdown: ['md'],
  text: ['txt'],
} as const satisfies Record<string, readonly string[]>;

export type DocumentFormat = keyof typeof DOCUMENT_FORMATS;

export const DOCUMENT_FORMAT_VALUES = Object.keys(DOCUMENT_FORMATS) as DocumentFormat[];

/** Upload constraints — enforced client-side for instant feedback and re-checked
 *  server-side. Kept beside the schema so both the dropzone and the API agree. */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

/**
 * Formats the backend accepts. Verified by probing the live API: anything outside
 * this list is refused with `REQ_400` "Chỉ hỗ trợ TXT, Markdown, CSV, PDF
 * text-layer, DOCX và XLSX". Legacy `.doc`/`.xls` are NOT accepted — only the
 * OOXML ones — so they are absent here rather than rejected server-side after
 * the user has already waited for the upload.
 */
export const ALLOWED_EXTENSIONS = ['txt', 'md', 'csv', 'pdf', 'docx', 'xlsx'] as const;
export const ACCEPT_ATTRIBUTE = '.txt,.md,.csv,.pdf,.docx,.xlsx';
