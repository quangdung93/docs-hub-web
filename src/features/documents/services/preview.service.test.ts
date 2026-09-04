/**
 * Self-check for preview support detection. Run with
 * `npx tsx src/features/documents/services/preview.service.test.ts`.
 *
 * Media types are the ones api.docshub.io.vn actually returns from
 * `.../revisions/{id}/view`, verified 04/09/2026.
 */
import assert from 'node:assert/strict';

import { previewKindOf } from './preview.service';

// ── What the backend really sends ───────────────────────────────────────────
assert.equal(previewKindOf('application/pdf'), 'pdf');
assert.equal(previewKindOf('text/markdown'), 'text');
assert.equal(previewKindOf('text/csv'), 'text');
assert.equal(previewKindOf('text/plain'), 'text');

// ── OOXML has no browser renderer; claiming otherwise shows a blank frame ────
assert.equal(
  previewKindOf('application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
  'unsupported'
);
assert.equal(
  previewKindOf('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
  'unsupported'
);

// ── A charset parameter must not defeat the match ───────────────────────────
assert.equal(previewKindOf('text/markdown; charset=utf-8'), 'text');
assert.equal(previewKindOf('APPLICATION/PDF'), 'pdf');

// ── Extension is a fallback only when the type says nothing ─────────────────
assert.equal(previewKindOf('application/octet-stream', 'a.pdf'), 'pdf');
assert.equal(previewKindOf('', 'notes.md'), 'text');
assert.equal(previewKindOf(undefined, 'shot.png'), 'image');
assert.equal(previewKindOf('application/octet-stream', 'report.docx'), 'unsupported');

// ── A real type wins over a misleading name ─────────────────────────────────
assert.equal(
  previewKindOf('application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'a.pdf'),
  'unsupported',
  'the served type is the authority, not the filename'
);

// ── Missing everything is unsupported, not a crash ──────────────────────────
assert.equal(previewKindOf(undefined), 'unsupported');
assert.equal(previewKindOf(''), 'unsupported');

console.log('preview.service: all assertions passed');
