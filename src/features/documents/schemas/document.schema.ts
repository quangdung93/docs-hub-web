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
  markdown: ['md'],
  text: ['txt'],
} as const satisfies Record<string, readonly string[]>;

export type DocumentFormat = keyof typeof DOCUMENT_FORMATS;

export const DOCUMENT_FORMAT_VALUES = Object.keys(DOCUMENT_FORMATS) as DocumentFormat[];

/** Upload constraints — enforced client-side for instant feedback and re-checked
 *  server-side. Kept beside the schema so both the dropzone and the API agree. */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
export const ALLOWED_EXTENSIONS = ['pdf', 'docx', 'doc', 'txt', 'md'] as const;
export const ACCEPT_ATTRIBUTE = '.pdf,.docx,.doc,.txt,.md';
