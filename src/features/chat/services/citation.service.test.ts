/**
 * Self-check for the answer parser — the one piece of non-trivial logic in the
 * chat slice. Run with `npx tsx src/features/chat/services/citation.service.test.ts`.
 * Deliberately assert-based: the repo has no test runner wired up yet (Module 8),
 * and this needs none.
 */
import assert from 'node:assert/strict';

import { pageRangeOf, parseAnswer, renderExcerpt } from './citation.service';

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

// ── renderExcerpt ───────────────────────────────────────────────────────────
// Fixtures are real excerpts from api.docshub.io.vn (03/09/2026): the backend
// serialises Word tables to HTML and cuts every excerpt at 1000 characters
// without regard for markup.

// Plain prose passes through untouched — the common case must not be reshaped.
{
  const plain = 'Phân tích thiết kế, lập trình.Kiểm thử phần mềm.Nghiệm thu.';
  const result = renderExcerpt(plain);
  assert.equal(result.text, plain);
  assert.equal(result.isTable, false);
  assert.equal(result.isTruncated, false);
  assert.equal(result.caption, null);
}

// A complete table becomes one cell per line, rows separated by a blank line.
{
  const result = renderExcerpt(
    '<table><caption>Table Location: doc > B. TỔNG QUAN</caption>' +
      '<tr><td>STT</td><td>CHỨC NĂNG</td></tr>' +
      '<tr><td>1</td><td>Đăng nhập</td></tr></table>'
  );
  assert.equal(result.isTable, true);
  assert.equal(result.caption, 'Table Location: doc > B. TỔNG QUAN');
  assert.equal(result.text, 'STT\nCHỨC NĂNG\n\n1\nĐăng nhập');
  assert.equal(result.isTruncated, false, 'a closed table is not truncated');
  assert.ok(!result.text.includes('<'), 'no markup may survive into the text');
}

// The caption is lifted out, so it must not also appear in the body.
{
  const result = renderExcerpt('<table><caption>Vị trí bảng</caption><tr><td>A</td></tr></table>');
  assert.equal(result.caption, 'Vị trí bảng');
  assert.equal(result.text, 'A');
}

// The real failure: cut at 1000 chars, mid-tag. The fragment must not leak.
{
  const result = renderExcerpt('<table><tr><td>6</td><td>Tóm tắt & Trích xuất</td');
  assert.equal(result.isTruncated, true, 'a tag cut in half means content is missing');
  assert.equal(result.text, '6\nTóm tắt & Trích xuất', 'the half-written tag is dropped');
  assert.ok(!result.text.includes('<'), 'no fragment of the cut tag may show');
}

// Cut between tags — no dangling "<", but rows are still unclosed.
{
  const result = renderExcerpt('<table><tr><td>A</td></tr><tr><td>B</td>');
  assert.equal(result.isTruncated, true, 'an unclosed row means content is missing');
  assert.equal(result.text, 'A\n\nB');
}

// Entities decode, and "&amp;lt;" must not double-decode into a real "<".
{
  assert.equal(renderExcerpt('<p>a &amp; b</p>').text, 'a & b');
  assert.equal(renderExcerpt('<p>&lt;td&gt;</p>').text, '<td>');
  assert.equal(renderExcerpt('<p>&amp;lt;</p>').text, '&lt;', 'an escaped entity stays escaped');
}

// Empty cells must not print as blank lines.
{
  const result = renderExcerpt('<table><tr><td>A</td><td></td><td>B</td></tr></table>');
  assert.equal(result.text, 'A\nB');
}

// <br> inside a cell is a real line break in the source document.
{
  assert.equal(renderExcerpt('<table><tr><td>A<br/>B</td></tr></table>').text, 'A\nB');
}

// Absent or empty input is a real response shape, not an error.
{
  assert.equal(renderExcerpt(undefined).text, '');
  assert.equal(renderExcerpt('').text, '');
  assert.equal(renderExcerpt(undefined).isTable, false);
}

// Text that merely mentions a "<" must not be mistaken for markup.
{
  const prose = 'Nếu a < b thì hệ thống báo lỗi.';
  const result = renderExcerpt(prose);
  assert.equal(result.isTable, false);
  assert.equal(result.text, prose);
}

console.log('citation.service: all assertions passed');
