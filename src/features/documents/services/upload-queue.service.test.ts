/**
 * Self-check for the upload/format helpers. Run with:
 *   npx tsx src/features/documents/services/upload-queue.service.test.ts
 * Assert-based on purpose: no test runner is wired up yet (Module 8), and this
 * needs none.
 */
import assert from 'node:assert/strict';

import { MAX_UPLOAD_BYTES } from '../schemas/document.schema';

import { formatBytes, matchesFormat, validateFile } from './upload-queue.service';

// 'all' matches everything, including extensions with no bucket.
assert.equal(matchesFormat('a.pdf', 'all'), true);
assert.equal(matchesFormat('no-extension', 'all'), true);

// Buckets match their own extensions and nothing else.
assert.equal(matchesFormat('Quy_trinh.pdf', 'pdf'), true);
assert.equal(matchesFormat('Quy_trinh.pdf', 'word'), false);

// doc/docx and xls/xlsx collapse into one application bucket.
assert.equal(matchesFormat('bien_ban.doc', 'word'), true);
assert.equal(matchesFormat('bien_ban.docx', 'word'), true);
assert.equal(matchesFormat('thuat_ngu.xlsx', 'excel'), true);

// Extension matching is case-insensitive — uploads often arrive as .PDF.
assert.equal(matchesFormat('SCAN.PDF', 'pdf'), true);

// A dotted filename keys off the LAST segment, not the first.
assert.equal(matchesFormat('bao.cao.v2.md', 'markdown'), true);
assert.equal(matchesFormat('bao.cao.v2.md', 'pdf'), false);

// Unknown extension belongs to no bucket.
assert.equal(matchesFormat('anh.png', 'pdf'), false);
assert.equal(matchesFormat('anh.png', 'text'), false);

// Upload validation: allowed type under the cap is accepted.
assert.equal(validateFile({ name: 'ok.pdf', size: 1024 }), 'uploading');
// Unsupported extension is rejected on format, even when tiny.
assert.equal(validateFile({ name: 'anh.png', size: 10 }), 'rejected-format');
// Allowed type over the cap is rejected on size.
assert.equal(validateFile({ name: 'big.pdf', size: MAX_UPLOAD_BYTES + 1 }), 'rejected-size');
// Exactly at the cap is still allowed (the limit is inclusive).
assert.equal(validateFile({ name: 'edge.pdf', size: MAX_UPLOAD_BYTES }), 'uploading');

// Byte formatting crosses units, keeping one decimal below 10 and rounding above.
assert.equal(formatBytes(512), '512 B');
assert.equal(formatBytes(2_517_000), '2.4 MB');
assert.equal(formatBytes(122_880), '120 KB');

console.log('upload-queue.service: all assertions passed');
