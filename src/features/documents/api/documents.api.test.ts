/**
 * Self-check for reading the export filename off the response. Run with
 * `npx tsx src/features/documents/api/documents.api.test.ts`.
 *
 * The header shape is the one api.docshub.io.vn actually sends, captured
 * 07/09/2026: `attachment; filename=UAT_Report_DOCS-HUB-DEMO_all.xlsx`.
 */
import assert from 'node:assert/strict';

import { fileNameFrom, toUatReportBody } from './documents.api';

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

// ── UAT report body ─────────────────────────────────────────────────────────
// The date widening is the load-bearing part: the short form the date input
// produces is rejected with REQ_400, the RFC 3339 form is accepted.
assert.deepEqual(toUatReportBody({ startDate: '2026-09-01' }), {
  start_date: '2026-09-01T00:00:00Z',
});
assert.deepEqual(toUatReportBody({ dueDate: '2026-09-30' }), {
  due_date: '2026-09-30T00:00:00Z',
});

// An empty body is legal and means "whole project, xlsx".
assert.deepEqual(toUatReportBody({}), {});

// Blank and whitespace-only fields are dropped, not sent as empty strings —
// the backend prints what it is given straight into the sheet.
assert.deepEqual(toUatReportBody({ po: '   ', pm: '', startDate: '  ' }), {});

assert.deepEqual(
  toUatReportBody({
    format: 'pdf',
    projectVersionId: '2727537a-b566-4a8d-8ac2-a22d703da58e',
    po: '  Nguyễn Văn A  ',
    scopeTest: 'Phạm vi kiểm thử',
  }),
  {
    format: 'pdf',
    project_version_id: '2727537a-b566-4a8d-8ac2-a22d703da58e',
    po: 'Nguyễn Văn A',
    scope_test: 'Phạm vi kiểm thử',
  },
  'field names are snake_case on the wire, and values are trimmed'
);

console.log('documents.api: all assertions passed');
