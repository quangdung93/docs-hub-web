import { type NextRequest, NextResponse } from 'next/server';

import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  accessCookieOptions,
  refreshCookieOptions,
} from '@/core/auth/cookies';
import { refreshTokens } from '@/core/auth/refresh';
import { type TokenPair } from '@/core/auth/tokens';
import { serverEnv } from '@/core/config/env';

/**
 * BFF proxy — the single same-origin egress the browser is allowed to hit.
 * Everything the client fetches goes `/api/<path>` → here → `${API_URL}/<path>`.
 *
 * Responsibilities:
 *  - Attach the access token from the httpOnly cookie server-side (client never
 *    sees it), and refresh it once on a 401 — middleware only covers navigation,
 *    its matcher excludes `/api/*`.
 *  - CSRF: reject unsafe methods that aren't same-origin (cookies are SameSite=Lax,
 *    which still allows cross-site top-level POST navigations).
 *  - Never forward the browser's cookies to the backend — auth is Bearer only.
 */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Hop-by-hop / sensitive headers we must not forward upstream.
const STRIPPED_REQUEST_HEADERS = new Set([
  'host',
  'cookie',
  'connection',
  'content-length',
  /**
   * `origin` and `referer` describe the *browser's* page, not this server-to-
   * server hop, so they are meaningless upstream — and docs-hub-api answers a
   * bare 403 (empty body, no envelope) to any request carrying an `Origin`,
   * including GETs. Verified 24/08/2026: identical requests differing only by
   * this header return 201 without it and 403 with it.
   */
  'origin',
  'referer',
]);

function isSameOrigin(req: NextRequest): boolean {
  const site = req.headers.get('sec-fetch-site');
  if (site) return site === 'same-origin' || site === 'none';
  // Fallback for clients that don't send Sec-Fetch-*: compare Origin host.
  const origin = req.headers.get('origin');
  if (!origin) return true;
  try {
    return new URL(origin).host === req.headers.get('host');
  } catch {
    return false;
  }
}

async function handler(req: NextRequest, ctx: { params: Promise<{ proxy: string[] }> }) {
  if (!SAFE_METHODS.has(req.method) && !isSameOrigin(req)) {
    return NextResponse.json(
      { success: false, error: { code: 'ERR_CSRF', message: 'Cross-site request blocked' } },
      { status: 403 }
    );
  }

  const { proxy } = await ctx.params;
  const target = `${serverEnv.API_URL}/${proxy.join('/')}${req.nextUrl.search}`;

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (!STRIPPED_REQUEST_HEADERS.has(key.toLowerCase())) headers.set(key, value);
  });

  const token = req.cookies.get(ACCESS_COOKIE)?.value;
  if (token) headers.set('authorization', `Bearer ${token}`);

  // Đọc body một lần rồi giữ lại: `req.arrayBuffer()` tiêu luôn stream, nên lần
  // gọi lại sau khi refresh phải dùng chính buffer này chứ không đọc lại được.
  const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.arrayBuffer();

  const send = (accessToken?: string) => {
    const outgoing = new Headers(headers);
    if (accessToken) outgoing.set('authorization', `Bearer ${accessToken}`);
    return fetch(target, { method: req.method, headers: outgoing, body, cache: 'no-store' });
  };

  let upstream: Response;
  try {
    upstream = await send(token);
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'ERR_UPSTREAM', message: 'Upstream unreachable' } },
      { status: 502 }
    );
  }

  /**
   * Refresh-on-401, đúng một lần.
   *
   * Middleware đã lo refresh khi điều hướng, nhưng matcher của nó loại trừ
   * `/api/*` — nên một thao tác trong trang (bấm nút, gọi API) rơi vào lúc access
   * token vừa hết hạn thì trước đây trả thẳng 401 cho người dùng, dù refresh
   * token còn sống 14 ngày.
   *
   * `refreshTokens` đã tự single-flight, nên 10 request song song cùng gặp 401
   * chỉ tạo một lần gọi refresh thật.
   *
   * Chỉ thử lại đúng một lần: nếu lần hai vẫn 401 thì đó là lỗi quyền chứ không
   * phải token hết hạn, thử tiếp chỉ kéo dài thời gian chờ của người dùng.
   */
  let rotated: TokenPair | null = null;
  if (upstream.status === 401) {
    const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value;
    if (refreshToken) {
      rotated = await refreshTokens(refreshToken);
      if (rotated) {
        try {
          upstream = await send(rotated.accessToken);
        } catch {
          return NextResponse.json(
            { success: false, error: { code: 'ERR_UPSTREAM', message: 'Upstream unreachable' } },
            { status: 502 }
          );
        }
      }
    }
  }

  // Stream the upstream response back, dropping hop-by-hop headers.
  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.delete('transfer-encoding');
  responseHeaders.delete('content-encoding');
  responseHeaders.delete('content-length');

  const res = new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });

  // Ghi cặp token mới xuống trình duyệt. Backend rotate ở mỗi lần refresh và thu
  // hồi refresh token cũ ngay, nên không lưu lại là lần refresh sau chết.
  if (rotated) {
    res.cookies.set(ACCESS_COOKIE, rotated.accessToken, accessCookieOptions());
    res.cookies.set(REFRESH_COOKIE, rotated.refreshToken, refreshCookieOptions());
  }

  return res;
}

export {
  handler as GET,
  handler as POST,
  handler as PUT,
  handler as PATCH,
  handler as DELETE,
  handler as HEAD,
};
