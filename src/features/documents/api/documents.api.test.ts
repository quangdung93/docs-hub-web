/**
 * Self-check for reading the export filename off the response. Run with
 * `npx tsx src/features/documents/api/documents.api.test.ts`.
 *
 * The header shape is the one api.docshub.io.vn actually sends, captured
 * 07/09/2026: `attachment; filename=UAT_Report_DOCS-HUB-DEMO_all.xlsx`.
 */
import assert from 'node:assert/strict';

import { fileNameFrom } from './documents.api';

// ── What the backend really sends ───────────────────────────────────────────
assert.equal(
  fileNameFrom('attachment; filename=UAT_Report_DOCS-HUB-DEMO_all.xlsx'),
  'UAT_Report_DOCS-HUB-DEMO_all.xlsx'
);

// ── Quoted form, which is equally legal ─────────────────────────────────────
assert.equal(fileNameFrom('attachment; filename="Báo cáo.xlsx"'), 'Báo cáo.xlsx');

// ── RFC 5987 wins, because it is the form that survives non-ASCII ───────────
assert.equal(
  fileNameFrom("attachment; filename=fallback.xlsx; filename*=UTF-8''B%C3%A1o%20c%C3%A1o.xlsx"),
  'Báo cáo.xlsx',
  'the encoded form is preferred over the ASCII fallback'
);

// ── A broken escape must fall back, not throw ───────────────────────────────
assert.equal(
  fileNameFrom("attachment; filename=ok.xlsx; filename*=UTF-8''%E0%A4%A"),
  'ok.xlsx',
  'a malformed percent-escape falls through to the plain filename'
);

// ── Missing or unusable headers yield null, so the caller picks a default ───
assert.equal(fileNameFrom(undefined), null);
assert.equal(fileNameFrom(''), null);
assert.equal(fileNameFrom('attachment'), null, 'no filename parameter at all');
assert.equal(fileNameFrom(123), null, 'a non-string header is not a crash');

console.log('documents.api: all assertions passed');
