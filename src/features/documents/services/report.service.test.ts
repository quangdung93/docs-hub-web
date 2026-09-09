/**
 * Self-check for report filenames. Run with
 * `npx tsx src/features/documents/services/report.service.test.ts`.
 *
 * The shapes here are what `POST .../projects/{id}/reports` really returns,
 * captured 09/09/2026.
 */
import assert from 'node:assert/strict';

import { reportDownloadHref, reportFileName } from './report.service';

// ── The three types the backend generates ───────────────────────────────────
assert.equal(
  reportFileName('uat', 'xlsx', '2026-09-09T03:50:11.535209136Z'),
  'UAT_Report_2026-09-09.xlsx'
);
assert.equal(
  reportFileName('planning', 'pdf', '2026-09-09T03:51:13Z'),
  'Project_Planning_2026-09-09.pdf'
);
assert.equal(
  reportFileName('testcase', 'xlsx', '2026-09-08T03:02:23Z'),
  'Test_Case_2026-09-08.xlsx'
);

// ── A type the UI has not been taught yet still gets a usable name ──────────
assert.equal(reportFileName('rtm', 'xlsx', '2026-09-09T00:00:00Z'), 'Report_2026-09-09.xlsx');

// ── Missing or malformed metadata degrades, it does not throw ───────────────
assert.equal(reportFileName('uat', 'xlsx'), 'UAT_Report.xlsx', 'no timestamp, no date suffix');
assert.equal(reportFileName('uat', 'xlsx', 'not-a-date'), 'UAT_Report.xlsx');
assert.equal(reportFileName('uat', ''), 'UAT_Report.xlsx', 'an empty format falls back to xlsx');

// ── The relay href ──────────────────────────────────────────────────────────
// The presigned URL carries `&` between its X-Amz-* params; it must survive
// encoding intact or storage rejects the signature.
const signed =
  'https://storage.docshub.io.vn/document-hub/reports/p1/abc.xlsx' +
  '?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=deadbeef';
const href = reportDownloadHref(signed, 'planning', 'xlsx', '2026-09-09T03:51:13Z');

assert.ok(href.startsWith('/api/storage-get?'), 'goes through the same-origin relay');

const params = new URLSearchParams(href.slice(href.indexOf('?') + 1));
assert.equal(params.get('url'), signed, 'the signed URL round-trips unmangled');
assert.equal(params.get('filename'), 'Project_Planning_2026-09-09.xlsx');

console.log('report.service: all assertions passed');
