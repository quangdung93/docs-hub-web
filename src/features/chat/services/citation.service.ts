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
 * Does this excerpt read as code rather than prose?
 *
 * Excerpts are raw document text, and a chunk lifted out of an AndroidManifest or
 * a config file is unreadable in a proportional font — the indentation that gives
 * it structure collapses visually. Prose is the common case, so the test is
 * deliberately conservative: it only fires on markers that essentially never
 * appear in a sentence.
 *
 * ponytail: heuristic, not a parser. The cost of a wrong answer is a font choice,
 * so a language detector would be gold-plating.
 */
export function looksLikeCode(excerpt: string | undefined): boolean {
  if (!excerpt) return false;

  const markers = [
    /<\/?[a-z][\w.-]*[\s>/]/i, // an XML/HTML tag
    /\/>/, // a self-closing tag
    /^\s*[{}[\]]/m, // a line opening or closing a block
    /^\s*(?:function|const|let|var|class|import|export|def|public|private)\s/m,
    /^\s*```/m, // a fenced block
    /^\s*[\w.-]+\s*[:=]\s*["'{[]/m, // key = "value" / key: {
  ];

  return markers.some((marker) => marker.test(excerpt));
}
