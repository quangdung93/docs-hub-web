/**
 * Self-check for the answer parser — the one piece of non-trivial logic in the
 * chat slice. Run with `npx tsx src/features/chat/services/citation.service.test.ts`.
 * Deliberately assert-based: the repo has no test runner wired up yet (Module 8),
 * and this needs none.
 */
import assert from 'node:assert/strict';

import { looksLikeCode, pageRangeOf, parseAnswer } from './citation.service';

// Markers become citation segments, surrounding text is preserved verbatim.
assert.deepEqual(parseAnswer('OTP is required[1].', [1]), [
  { kind: 'text', value: 'OTP is required' },
  { kind: 'citation', index: 1 },
  { kind: 'text', value: '.' },
]);

// The same marker may appear more than once.
assert.equal(parseAnswer('a[1] b[2] c[1]', [1, 2]).filter((s) => s.kind === 'citation').length, 3);

// A marker with no matching citation stays literal text — never a dead button.
assert.deepEqual(parseAnswer('see [7] please', [1]), [{ kind: 'text', value: 'see [7] please' }]);

// No markers at all: one text segment.
assert.deepEqual(parseAnswer('plain answer', []), [{ kind: 'text', value: 'plain answer' }]);

// Leading marker produces no empty text segment before it.
assert.deepEqual(parseAnswer('[1] starts here', [1]), [
  { kind: 'citation', index: 1 },
  { kind: 'text', value: ' starts here' },
]);

// Page ranges collapse duplicates and sort.
assert.equal(pageRangeOf([5, 4, 4]), '4–5');
assert.equal(pageRangeOf([3]), '3');
assert.equal(pageRangeOf([]), '');

// ── looksLikeCode ───────────────────────────────────────────────────────────

// The real case that prompted this: an AndroidManifest chunk, unreadable when
// its indentation collapses into a proportional font.
assert.equal(
  looksLikeCode('<uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />'),
  true
);
assert.equal(looksLikeCode('  {\n    "chunk_size": 800\n  }'), true);
assert.equal(looksLikeCode('export function toDocument(dto) {'), true);
assert.equal(looksLikeCode('```\nmã nguồn\n```'), true);
assert.equal(looksLikeCode('API_URL = "http://api:8080"'), true);

// Prose stays prose — including Vietnamese, and including sentences that happen
// to contain punctuation the markers care about.
assert.equal(looksLikeCode('Quy trình kiểm thử DOCX gồm ba bước.'), false);
assert.equal(looksLikeCode('Bước 1: Kiểm tra định dạng tệp đầu vào.'), false);
assert.equal(looksLikeCode('Chi phí < 100 và > 50 nghìn đồng.'), false);
assert.equal(looksLikeCode(''), false);
assert.equal(looksLikeCode(undefined), false);

console.log('citation.service: all assertions passed');
