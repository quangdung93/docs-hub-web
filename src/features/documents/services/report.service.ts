/**
 * Naming for RAGFlow-generated reports.
 *
 * The template export (`documents/uat-report`) gets its filename from the
 * backend's `Content-Disposition`. The RAGFlow one has no such luxury: storage
 * serves the object without that header and the key is a bare UUID, so a
 * download named itself `8352c1c5-1dac-4050-ab24-bf2c3436b905.xlsx` until this
 * existed. The name is built client-side because nothing on the wire carries a
 * better one.
 */

/** Human labels for the report types, used in filenames only. */
const TYPE_NAMES: Record<string, string> = {
  uat: 'UAT_Report',
  planning: 'Project_Planning',
  testcase: 'Test_Case',
};

/**
 * `UAT_Report_2026-09-09.xlsx`.
 *
 * The date rather than a counter, because two exports of the same type on
 * different days are the common case and the browser already de-duplicates
 * same-day repeats by appending `(1)`.
 *
 * `createdAt` is passed in rather than read from the clock so this stays a pure
 * function — the caller has the report's real timestamp anyway.
 */
export function reportFileName(reportType: string, format: string, createdAt?: string): string {
  const name = TYPE_NAMES[reportType] ?? 'Report';
  const day = (createdAt ?? '').slice(0, 10);
  const suffix = /^\d{4}-\d{2}-\d{2}$/.test(day) ? `_${day}` : '';
  return `${name}${suffix}.${format || 'xlsx'}`;
}

/**
 * Same-origin URL that downloads a presigned storage object under a real name.
 *
 * The presigned URL cannot be linked to directly — `connect-src 'self'` blocks
 * fetching it and a cross-origin href ignores `download`, so the file would
 * save as its UUID key. `/api/storage-get` relays it server-side and sets the
 * Content-Disposition. See that route for the full reasoning.
 */
export function reportDownloadHref(
  downloadUrl: string,
  reportType: string,
  format: string,
  createdAt?: string
): string {
  const params = new URLSearchParams({
    url: downloadUrl,
    filename: reportFileName(reportType, format, createdAt),
  });
  return `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/api/storage-get?${params.toString()}`;
}
