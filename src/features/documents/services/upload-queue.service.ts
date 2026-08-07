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
  'uploading' | 'embedding' | 'indexed' | 'rejected-format' | 'rejected-size';

export interface UploadItem {
  id: string;
  name: string;
  sizeBytes: number;
  status: UploadItemStatus;
  /** 0–100 while uploading; undefined once the server takes over (embedding). */
  progress?: number;
  chunkCount?: number;
}

export function extensionOf(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() ?? '';
}

/**
 * Does a file belong to a format bucket? `'all'` matches everything, so callers
 * pass the filter value straight through without branching on the sentinel.
 */
export function matchesFormat(fileName: string, format: DocumentFormat | 'all'): boolean {
  if (format === 'all') return true;
  return (DOCUMENT_FORMATS[format] as readonly string[]).includes(extensionOf(fileName));
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
  return status === 'indexed' || isRejected(status);
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
