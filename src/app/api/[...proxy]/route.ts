import { type NextRequest, NextResponse } from 'next/server';

import { serverEnv } from '@/core/config/env';

/**
 * BFF proxy — the single same-origin egress the browser is allowed to hit.
 * Everything the client fetches goes `/api/<path>` → here → `${API_URL}/<path>`.
 *
 * Responsibilities:
 *  - Attach the access token from the httpOnly cookie server-side (client never
 *    sees it). Single-flight refresh-on-401 is layered in Module 4.
 *  - CSRF: reject unsafe methods that aren't same-origin (cookies are SameSite=Lax,
 *    which still allows cross-site top-level POST navigations).
 *  - Never forward the browser's cookies to the backend — auth is Bearer only.
 */
const ACCESS_COOKIE = 'access_token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Hop-by-hop / sensitive headers we must not forward upstream.
const STRIPPED_REQUEST_HEADERS = new Set([
  'host',
  'cookie',
  'connection',
  'content-length',
  // Client-side correlation id for the API inspector — meaningless upstream.
  'x-api-log-id',
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

  const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.arrayBuffer();

  let upstream: Response;
  try {
    upstream = await fetch(target, { method: req.method, headers, body, cache: 'no-store' });
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'ERR_UPSTREAM', message: 'Upstream unreachable' } },
      { status: 502 }
    );
  }

  // Stream the upstream response back, dropping hop-by-hop headers.
  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.delete('transfer-encoding');
  responseHeaders.delete('content-encoding');
  responseHeaders.delete('content-length');

  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

export {
  handler as GET,
  handler as POST,
  handler as PUT,
  handler as PATCH,
  handler as DELETE,
  handler as HEAD,
};
