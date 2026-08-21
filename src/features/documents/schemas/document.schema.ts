import { z } from 'zod';

/**
 * Document contracts. `status` drives the badge colour, the upload-queue row and
 * the list filter, so it is a single enum rather than three parallel booleans.
 */
export const DocumentStatusSchema = z.enum(['indexed', 'processing', 'queued', 'failed']);

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
});

export const DocumentListSchema = z.array(DocumentSchema);

export type Document = z.infer<typeof DocumentSchema>;
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
