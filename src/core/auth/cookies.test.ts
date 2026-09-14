/**
 * Self-check cho hạn sống của access cookie. Chạy bằng
 * `npx tsx src/core/auth/cookies.test.ts`.
 *
 * Điểm cần giữ: cookie KHÔNG được chết trước token nó mang. Trước đây maxAge
 * hardcode 900 giây trong khi backend đã đổi token lên 86400, nên phiên rơi
 * giữa chừng và người dùng thấy "Thiếu hoặc sai định dạng token".
 */
import assert from 'node:assert/strict';

import { accessCookieOptions, refreshCookieOptions } from './cookies';

const FALLBACK = 60 * 15;

/** Dựng một JWT giả — chỉ cần phần payload đúng base64url, không cần chữ ký thật. */
function fakeJwt(payload: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify(payload))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `header.${body}.signature`;
}

const now = Math.floor(Date.now() / 1000);

// ── Token thật: cookie bám theo `exp` ───────────────────────────────────────
const oneDay = accessCookieOptions(fakeJwt({ exp: now + 86400 }));
assert.ok(
  oneDay.maxAge > 86000 && oneDay.maxAge <= 86400,
  `token 24h phải cho maxAge ~86400, nhận ${oneDay.maxAge}`
);

const fifteenMin = accessCookieOptions(fakeJwt({ exp: now + 900 }));
assert.ok(
  fifteenMin.maxAge > 800 && fifteenMin.maxAge <= 900,
  `token 15 phút phải cho maxAge ~900, nhận ${fifteenMin.maxAge}`
);

// ── Các trường hợp không đọc được `exp` → dùng dự phòng ─────────────────────
assert.equal(accessCookieOptions().maxAge, FALLBACK, 'không có token');
assert.equal(accessCookieOptions('').maxAge, FALLBACK, 'token rỗng');
assert.equal(accessCookieOptions('khong-phai-jwt').maxAge, FALLBACK, 'chuỗi không phải JWT');
assert.equal(accessCookieOptions('a.b').maxAge, FALLBACK, 'thiếu phần payload');
assert.equal(
  accessCookieOptions('header.KHONG-PHAI-BASE64-JSON.sig').maxAge,
  FALLBACK,
  'payload không giải mã được'
);
assert.equal(
  accessCookieOptions(fakeJwt({ sub: 'user' })).maxAge,
  FALLBACK,
  'payload hợp lệ nhưng thiếu exp'
);
assert.equal(
  accessCookieOptions(fakeJwt({ exp: 'khong-phai-so' })).maxAge,
  FALLBACK,
  'exp sai kiểu'
);

// Token đã hết hạn: trả về dự phòng chứ không phải 0 — maxAge 0 xoá cookie ngay,
// cắt luôn cơ hội cho luồng refresh chạy.
assert.equal(
  accessCookieOptions(fakeJwt({ exp: now - 3600 })).maxAge,
  FALLBACK,
  'token hết hạn vẫn phải cho maxAge dương'
);

// ── Thuộc tính bảo mật giữ nguyên ở mọi nhánh ───────────────────────────────
for (const options of [oneDay, accessCookieOptions(), refreshCookieOptions()]) {
  assert.equal(options.httpOnly, true, 'cookie auth luôn httpOnly');
  assert.equal(options.sameSite, 'lax');
  assert.equal(options.path, '/');
}

// Refresh cookie sống 14 ngày, không phụ thuộc access token.
assert.equal(refreshCookieOptions().maxAge, 60 * 60 * 24 * 14);

console.log('cookies: all assertions passed');
