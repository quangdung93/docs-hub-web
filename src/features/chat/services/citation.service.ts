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

/** Page range shown above the source list, e.g. "4–5" or "4". */
export function pageRangeOf(pages: readonly number[]): string {
  if (pages.length === 0) return '';
  const sorted = [...new Set(pages)].sort((a, b) => a - b);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  return first === last ? `${first}` : `${first}–${last}`;
}
