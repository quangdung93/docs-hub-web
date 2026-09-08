/**
 * Self-check for preview support detection. Run with
 * `npx tsx src/features/documents/services/preview.service.test.ts`.
 *
 * Media types are the ones api.docshub.io.vn actually returns from
 * `.../revisions/{id}/view`, verified 04/09/2026.
 */
import assert from 'node:assert/strict';

import { previewKindOf, sanitizeHrefs } from './preview.service';

// ── What the backend really sends ───────────────────────────────────────────
assert.equal(previewKindOf('application/pdf'), 'pdf');
assert.equal(previewKindOf('text/markdown'), 'text');
assert.equal(previewKindOf('text/csv'), 'text');
assert.equal(previewKindOf('text/plain'), 'text');

// ── Word converts in the page; Excel deliberately does not ──────────────────
assert.equal(
  previewKindOf('application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
  'docx'
);
assert.equal(
  previewKindOf('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
  'unsupported',
  'xlsx stays download-only: SheetJS has an unpatched prototype-pollution advisory'
);

// ── A charset parameter must not defeat the match ───────────────────────────
assert.equal(previewKindOf('text/markdown; charset=utf-8'), 'text');
assert.equal(previewKindOf('APPLICATION/PDF'), 'pdf');

// ── Extension is a fallback only when the type says nothing ─────────────────
assert.equal(previewKindOf('application/octet-stream', 'a.pdf'), 'pdf');
assert.equal(previewKindOf('', 'notes.md'), 'text');
assert.equal(previewKindOf(undefined, 'shot.png'), 'image');
assert.equal(previewKindOf('application/octet-stream', 'report.docx'), 'docx');
assert.equal(previewKindOf('application/octet-stream', 'sheet.xlsx'), 'unsupported');

// ── A real type wins over a misleading name ─────────────────────────────────
assert.equal(
  previewKindOf('application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'a.pdf'),
  'docx',
  'the served type is the authority, not the filename'
);

// ── Missing everything is unsupported, not a crash ──────────────────────────
assert.equal(previewKindOf(undefined), 'unsupported');
assert.equal(previewKindOf(''), 'unsupported');

// ── sanitizeHrefs: the one hole mammoth's output can carry ──────────────────
// mammoth generates its own tags, so a <script> in a Word file arrives as text.
// A hyperlink target is the one thing it copies verbatim.
assert.equal(
  sanitizeHrefs('<a href="https://docshub.io.vn">ok</a>'),
  '<a href="https://docshub.io.vn">ok</a>',
  'https links pass through'
);
assert.equal(
  sanitizeHrefs('<a href="http://example.com">ok</a>'),
  '<a href="http://example.com">ok</a>'
);
assert.equal(
  sanitizeHrefs('<a href="javascript:alert(1)">x</a>'),
  '<a href="#">x</a>',
  'a javascript: URL is the attack this exists to stop'
);
assert.equal(
  sanitizeHrefs('<a href="  JavaScript:alert(1)">x</a>'),
  '<a href="#">x</a>',
  'leading space and mixed case must not slip past'
);
assert.equal(
  sanitizeHrefs('<a href="data:text/html,<script>alert(1)</script>">x</a>'),
  '<a href="#">x</a>',
  'data: URLs are blocked too'
);
assert.equal(
  sanitizeHrefs('<a HREF="javascript:x">a</a><a href="https://a.vn">b</a>'),
  '<a href="#">a</a><a href="https://a.vn">b</a>',
  'every link is checked, not just the first'
);
assert.equal(sanitizeHrefs('<p>không có link</p>'), '<p>không có link</p>');

console.log('preview.service: all assertions passed');
