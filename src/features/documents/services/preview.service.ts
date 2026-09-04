/**
 * What a browser can actually render inline, given a media type.
 *
 * The backend serves every revision with `Content-Disposition: inline` and its
 * real media type, so the constraint is purely the browser's: PDFs and images
 * have native viewers, plain-text formats can be shown as text, and OOXML
 * (Word/Excel) has no renderer at all — those can only be downloaded.
 *
 * Deciding this from the media type rather than the extension because that is
 * what the server actually sends; a file named `.txt` served as PDF is the
 * server's answer, not the name's.
 */
export type PreviewKind = 'pdf' | 'image' | 'text' | 'unsupported';

const TEXT_TYPES = new Set(['text/plain', 'text/markdown', 'text/csv', 'application/json']);

export function previewKindOf(mediaType: string | undefined, fileName?: string): PreviewKind {
  const type = mediaType?.split(';')[0]?.trim().toLowerCase() ?? '';

  if (type === 'application/pdf') return 'pdf';
  if (type.startsWith('image/')) return 'image';
  if (TEXT_TYPES.has(type) || type.startsWith('text/')) return 'text';

  // Some servers send `application/octet-stream` for everything. Falling back to
  // the extension there recovers the common cases rather than declaring them
  // unsupported — but only when the type itself told us nothing.
  if (!type || type === 'application/octet-stream') {
    const extension = fileName?.split('.').pop()?.toLowerCase();
    if (extension === 'pdf') return 'pdf';
    if (extension && ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(extension))
      return 'image';
    if (extension && ['txt', 'md', 'csv', 'json', 'log'].includes(extension)) return 'text';
  }

  return 'unsupported';
}
