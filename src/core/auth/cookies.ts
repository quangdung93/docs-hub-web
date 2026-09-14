/**
 * Auth cookie policy in one place (read by the proxy, route handlers, and
 * middleware). Both tokens are httpOnly + SameSite=Lax + secure (in prod), so JS
 * can never read them. The refresh cookie stays at `path=/` (not `/api/auth`) on
 * purpose: middleware must read it to silently refresh during navigation. Scoping
 * it to `/api/auth` is a valid hardening if middleware refresh is ever dropped.
 */
export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';

const isProd = process.env.NODE_ENV === 'production';
/**
 * Dự phòng khi không đọc được hạn thật của token.
 *
 * KHÔNG hardcode theo `expires_in` của backend: con số đó đã đổi 900 → 86400 mà
 * client không hay, và cookie chết trước token thì phiên rơi trong lúc token vẫn
 * còn sống — đúng lỗi "Thiếu hoặc sai định dạng token" gặp phải. Giá trị thật lấy
 * từ `exp` trong JWT, xem `accessCookieOptions`.
 */
const ACCESS_MAX_AGE_FALLBACK = 60 * 15;
const REFRESH_MAX_AGE = 60 * 60 * 24 * 14; // 14d — matches REFRESH_TTL

/**
 * Hạn còn lại của access token, đọc từ `exp` trong chính JWT.
 *
 * Decode thủ công thay vì dùng thư viện: đây chỉ là đọc một số đã có sẵn trong
 * payload để đặt maxAge, không phải xác thực chữ ký — token này do backend cấp
 * và sẽ được chính backend kiểm tra ở mỗi request.
 */
function accessTokenMaxAge(token?: string): number {
  if (!token) return ACCESS_MAX_AGE_FALLBACK;
  try {
    const payload = token.split('.')[1];
    if (!payload) return ACCESS_MAX_AGE_FALLBACK;
    const decoded: unknown = JSON.parse(
      Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
    );
    const exp = (decoded as { exp?: unknown })?.exp;
    if (typeof exp !== 'number') return ACCESS_MAX_AGE_FALLBACK;

    const remaining = exp - Math.floor(Date.now() / 1000);
    // Token đã hết hạn thì đặt cookie cũng vô nghĩa, nhưng trả 0 sẽ xoá cookie
    // ngay — để fallback cho luồng refresh có cơ hội chạy.
    return remaining > 0 ? remaining : ACCESS_MAX_AGE_FALLBACK;
  } catch {
    return ACCESS_MAX_AGE_FALLBACK;
  }
}

interface CookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax' | 'strict' | 'none';
  path: string;
  maxAge: number;
}

/**
 * Truyền `token` vào để cookie sống đúng bằng token nó mang. Bỏ trống thì dùng
 * giá trị dự phòng — chỉ nên xảy ra ở chỗ không có token trong tay.
 */
export function accessCookieOptions(token?: string): CookieOptions {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: accessTokenMaxAge(token),
  };
}

export function refreshCookieOptions(): CookieOptions {
  return { httpOnly: true, secure: isProd, sameSite: 'lax', path: '/', maxAge: REFRESH_MAX_AGE };
}

/** Options for clearing a cookie (maxAge 0). */
export function clearCookieOptions(): CookieOptions {
  return { httpOnly: true, secure: isProd, sameSite: 'lax', path: '/', maxAge: 0 };
}
