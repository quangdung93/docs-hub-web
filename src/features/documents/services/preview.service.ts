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
 *
 * `.docx` is converted in the page by mammoth, which reads the document body
 * and drops Word's own styling — headers, footers, and embedded images do not
 * survive. It is a readable preview, not a faithful render; the download is
 * still there for the real thing.
 *
 * `.xlsx` stays unsupported. The obvious library for it (SheetJS) carries an
 * unpatched high-severity prototype-pollution advisory that triggers on parsing
 * a workbook — which is exactly what this would do with a user-uploaded file.
 * Not worth a preview.
 */
export type PreviewKind = 'pdf' | 'image' | 'text' | 'docx' | 'unsupported';

/** Word, which needs converting before a browser can show it. */
const DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const TEXT_TYPES = new Set(['text/plain', 'text/markdown', 'text/csv', 'application/json']);

export function previewKindOf(mediaType: string | undefined, fileName?: string): PreviewKind {
  const type = mediaType?.split(';')[0]?.trim().toLowerCase() ?? '';

  if (type === 'application/pdf') return 'pdf';
  if (type.startsWith('image/')) return 'image';
  if (TEXT_TYPES.has(type) || type.startsWith('text/')) return 'text';
  // No browser renders .docx, but mammoth converts it to HTML in the page.
  if (type === DOCX_TYPE) return 'docx';

  // Some servers send `application/octet-stream` for everything. Falling back to
  // the extension there recovers the common cases rather than declaring them
  // unsupported — but only when the type itself told us nothing.
  if (!type || type === 'application/octet-stream') {
    const extension = fileName?.split('.').pop()?.toLowerCase();
    if (extension === 'pdf') return 'pdf';
    if (extension && ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(extension))
      return 'image';
    if (extension && ['txt', 'md', 'csv', 'json', 'log'].includes(extension)) return 'text';
    if (extension === 'docx') return 'docx';
  }

  return 'unsupported';
}

/**
 * Drop any link target that is not http(s), for HTML produced by mammoth.
 *
 * mammoth generates its own tags rather than passing markup through, so a
 * `<script>` written into a Word file arrives as text, not as a node. The one
 * thing it copies verbatim is a hyperlink's target — which is how a
 * `javascript:` URL could otherwise reach the page.
 */
export function sanitizeHrefs(html: string): string {
  return html.replace(/href\s*=\s*"([^"]*)"/gi, (match, href: string) =>
    /^https?:\/\//i.test(href.trim()) ? match : 'href="#"'
  );
}
