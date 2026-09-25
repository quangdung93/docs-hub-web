/**
 * Self-check cho mốc thời gian tương đối. Chạy bằng
 * `npx tsx src/shared/lib/format.test.ts`.
 *
 * Lý do: dưới một phút, `Intl.RelativeTimeFormat` trả "phút này" — ngay sau khi
 * tải tệp lên, bảng hiện chữ đó và người dùng tưởng là lỗi.
 */
import assert from 'node:assert/strict';

import { formatRelativeTime } from './format';

const now = Date.parse('2026-09-25T10:00:00Z');
const ago = (ms: number) => new Date(now - ms).toISOString();

// Dưới một phút → "vài giây trước", kể cả đúng thời điểm và lệch đồng hồ vài giây.
for (const ms of [0, 1_000, 30_000, 59_999, -5_000]) {
  assert.equal(formatRelativeTime(ago(ms), 'vi', now), 'vài giây trước', `lệch ${ms}ms`);
  assert.equal(formatRelativeTime(ago(ms), 'en', now), 'a few seconds ago', `lệch ${ms}ms`);
}

// Từ một phút trở lên vẫn do Intl lo, không được đụng tới.
assert.notEqual(formatRelativeTime(ago(60_000), 'vi', now), 'vài giây trước');
assert.match(formatRelativeTime(ago(5 * 60_000), 'vi', now), /5 phút trước/);
assert.match(formatRelativeTime(ago(13 * 3_600_000), 'vi', now), /13 giờ trước/);

console.log('format: all assertions passed');
