import {
  ALLOWED_EXTENSIONS,
  DOCUMENT_FORMATS,
  MAX_UPLOAD_BYTES,
  type DocumentFormat,
} from '../schemas/document.schema';

/**
 * Upload-queue domain logic, deliberately free of React so it is testable on its
 * own (see `upload-queue.service.test.ts`). The component only renders whatever
 * state this module produces.
 */
export type UploadItemStatus =
  | 'uploading'
  | 'embedding'
  | 'indexed'
  /** The server refused the upload, or storage failed — distinct from the two
   *  client-side rejections below, which never reached the server at all. */
  | 'failed'
  | 'rejected-format'
  | 'rejected-size';

export interface UploadItem {
  id: string;
  name: string;
  sizeBytes: number;
  status: UploadItemStatus;
  /** 0–100 while uploading; undefined once the server takes over (embedding). */
  progress?: number;
  chunkCount?: number;
  /** Why the row failed, when the reason is known ahead of the request. */
  error?: 'no-version';
  /** The backend's own message for a server-side failure, shown verbatim. */
  errorMessage?: string;
  /** Set once the server has accepted the file; enables retry and download. */
  documentId?: string;
  revisionId?: string;
}

export function extensionOf(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() ?? '';
}

/**
 * Does a file belong to a format bucket? `'all'` matches everything, so callers
 * pass the filter value straight through without branching on the sentinel.
 *
 * Matches on the extension when there is one, and otherwise on the document's
 * format label ("Excel", "PDF"). Both are needed: the upload queue knows a real
 * file name, while a stored document is titled by its uploader and may carry no
 * extension at all — filtering those on the file name alone would hide every row.
 */
export function matchesFormat(
  fileName: string,
  format: DocumentFormat | 'all',
  formatLabel?: string
): boolean {
  if (format === 'all') return true;

  const extensions = DOCUMENT_FORMATS[format] as readonly string[];
  const extension = extensionOf(fileName);
  if (extension && extensions.includes(extension)) return true;

  // `format` is the bucket key ('excel'); the label is what the mapper produced
  // from the MIME type ('Excel'). Compare case-insensitively.
  return Boolean(formatLabel) && formatLabel!.toLowerCase() === String(format).toLowerCase();
}

/** A rejected file still enters the queue — the user needs to see *why* it failed. */
export function validateFile(file: { name: string; size: number }): UploadItemStatus {
  if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(extensionOf(file.name))) {
    return 'rejected-format';
  }
  if (file.size > MAX_UPLOAD_BYTES) return 'rejected-size';
  return 'uploading';
}

export function isRejected(status: UploadItemStatus): boolean {
  return status === 'rejected-format' || status === 'rejected-size';
}

export function isSettled(status: UploadItemStatus): boolean {
  return status === 'indexed' || status === 'failed' || isRejected(status);
}

/** Progress counter under the queue heading: "2/4 complete". */
export function queueProgress(items: readonly UploadItem[]): { done: number; total: number } {
  return {
    done: items.filter((item) => item.status === 'indexed').length,
    total: items.length,
  };
}

/** Format bytes the way the document table and the queue both display them. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value >= 10 ? Math.round(value) : value.toFixed(1)} ${units[unitIndex]}`;
}
