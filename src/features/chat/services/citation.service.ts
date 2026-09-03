/**
 * Answer-text parsing. The backend returns citations as `[1]` markers inline in
 * the text; the UI needs them as interactive elements. Splitting that out here
 * keeps the renderer a pure map over segments — and makes the tricky part
 * (marker matching) testable without React.
 */
export type AnswerSegment = { kind: 'text'; value: string } | { kind: 'citation'; index: number };

const MARKER = /\[(\d+)\]/g;

/**
 * Split an answer into text runs and citation markers, preserving order.
 * Markers whose index has no matching citation stay literal text — a dangling
 * `[7]` should render as typed, not as a button that highlights nothing.
 */
export function parseAnswer(text: string, validIndexes: readonly number[]): AnswerSegment[] {
  const segments: AnswerSegment[] = [];
  let cursor = 0;

  for (const match of text.matchAll(MARKER)) {
    const index = Number(match[1]);
    const start = match.index;

    if (!validIndexes.includes(index)) continue;

    if (start > cursor) segments.push({ kind: 'text', value: text.slice(cursor, start) });
    segments.push({ kind: 'citation', index });
    cursor = start + match[0].length;
  }

  if (cursor < text.length) segments.push({ kind: 'text', value: text.slice(cursor) });
  return segments;
}

/**
 * Page range shown above the source list, e.g. "4–5" or "4".
 * Citations without a page (the backend does not always supply one) are skipped
 * rather than rendered as a bogus 0.
 */
export function pageRangeOf(pages: readonly (number | undefined)[]): string {
  const known = pages.filter((page): page is number => page !== undefined);
  if (known.length === 0) return '';
  const sorted = [...new Set(known)].sort((a, b) => a - b);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  return first === last ? `${first}` : `${first}–${last}`;
}

/**
 * Excerpt after the backend's HTML has been turned into readable text.
 *
 * `isTruncated` is not cosmetic: the backend cuts excerpts at a fixed 1000
 * characters with no regard for markup, so the tail of a table is simply gone.
 * Rendering the surviving rows without saying so presents a partial table as a
 * whole one, which is worse than showing nothing.
 */
export interface RenderedExcerpt {
  /** Plain text, one table cell per line, ready for `whitespace-pre-wrap`. */
  text: string;
  /** Table caption, when the backend supplied one — it names the source section. */
  caption: string | null;
  /** True when the excerpt was cut mid-content and the reader is missing the end. */
  isTruncated: boolean;
  /** Whether the source was HTML at all; plain excerpts pass through untouched. */
  isTable: boolean;
}

/** Does this excerpt carry the HTML markup the backend emits for tables? */
function containsHtml(excerpt: string): boolean {
  return /<\/?(?:table|thead|tbody|tr|td|th|caption|p|div|ul|ol|li|h[1-6]|br)\b[^>]*>/i.test(
    excerpt
  );
}

/** The five entities that actually appear in this backend's output. */
function decodeEntities(text: string): string {
  return (
    text
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#0?39;|&apos;/g, "'")
      // Ampersand last, or "&amp;lt;" would decode twice into "<".
      .replace(/&amp;/g, '&')
  );
}

/**
 * Turn a backend excerpt into text a person can read in a narrow panel.
 *
 * The excerpts are Word tables serialised to HTML. Rendered as-is they show
 * their tags; rendered as real HTML they would need sanitising *and* a table
 * wide enough to be useless at 320px. So the markup becomes structure instead:
 * one cell per line, a blank line between rows.
 *
 * Nothing here is ever inserted as HTML — the output is a plain string. That
 * sidesteps XSS entirely rather than defending against it, which matters
 * because excerpts come from user-uploaded documents.
 *
 * ponytail: regex, not a DOM parse. The input is one generator's table markup,
 * and it arrives truncated mid-tag often enough that a strict parser would
 * reject what a person can still read.
 */
export function renderExcerpt(excerpt: string | undefined): RenderedExcerpt {
  if (!excerpt) {
    return { text: '', caption: null, isTruncated: false, isTable: false };
  }

  if (!containsHtml(excerpt)) {
    return { text: excerpt, caption: null, isTruncated: false, isTable: false };
  }

  // A trailing `<td` with no `>` means the cut landed inside a tag; an unclosed
  // <table> means it landed between them. Both lose the end of the content.
  const cutMidTag = /<[^>]*$/.test(excerpt);
  const openRows = (excerpt.match(/<tr\b/gi) ?? []).length;
  const closedRows = (excerpt.match(/<\/tr>/gi) ?? []).length;
  const isTruncated = cutMidTag || openRows > closedRows || !/<\/table>\s*$/i.test(excerpt.trim());

  // Drop a dangling partial tag before anything else, so its fragments cannot
  // leak into the text as stray characters.
  let working = excerpt.replace(/<[^>]*$/, '');

  // The caption names the document section this table came from — the single
  // most useful line for locating the passage, so it is lifted out rather than
  // left to blend into the cells.
  const captionMatch = working.match(/<caption[^>]*>([\s\S]*?)<\/caption>/i);
  const caption = captionMatch ? decodeEntities(stripTags(captionMatch[1]!)).trim() : null;
  working = working.replace(/<caption[^>]*>[\s\S]*?<\/caption>/gi, '');

  // Rows are split on their own boundary and cells within them on theirs, so an
  // empty cell can be dropped without also swallowing the blank line that
  // separates two rows. Collapsing on newline counts alone cannot tell those
  // apart — an empty middle cell and a row break both look like "\n\n".
  const rows = working
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|li|h[1-6])>/gi, '\n')
    .split(/<\/tr>/i)
    .map((row) =>
      row
        .split(/<\/(?:td|th)>/i)
        .map((cell) => decodeEntities(stripTags(cell)).trim())
        .filter(Boolean)
        .join('\n')
    )
    .filter(Boolean);

  return { text: rows.join('\n\n'), caption, isTruncated, isTable: true };
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}
