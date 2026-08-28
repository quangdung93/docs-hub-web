import { type NextRequest, NextResponse } from 'next/server';

import { failureEnvelope } from '@/core/api/errors';

/**
 * Server-side relay for a presigned storage PUT.
 *
 * The browser cannot make this request itself: the CSP pins `connect-src` to
 * `'self'`, so a `fetch` to storage.docshub.io.vn is blocked before it leaves the
 * page. Loosening the CSP would open every origin the app can talk to for the
 * sake of one upload — this keeps the browser same-origin and does the cross-host
 * hop server-side, which is the same shape as the rest of the BFF.
 *
 * The URL is already signed, so no credentials are attached (adding an
 * `Authorization` header actually breaks the S3 signature). The signature is what
 * authorises the write, and it is short-lived.
 */
const ALLOWED_HOSTS = new Set(['storage.docshub.io.vn']);

export async function PUT(req: NextRequest) {
  const target = req.nextUrl.searchParams.get('url');
  if (!target) {
    return NextResponse.json(failureEnvelope('REQ_400', 'Missing url'), { status: 400 });
  }

  // Never relay to an arbitrary host: without this the route is an open proxy
  // that anything on the page could aim anywhere.
  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return NextResponse.json(failureEnvelope('REQ_400', 'Malformed url'), { status: 400 });
  }
  if (parsed.protocol !== 'https:' || !ALLOWED_HOSTS.has(parsed.host)) {
    return NextResponse.json(failureEnvelope('REQ_403', 'Host not allowed'), { status: 403 });
  }

  // Buffered, not streamed. A streamed body goes out chunked with no
  // `Content-Length`, and S3 answers 411 to a PUT without one — the signature
  // covers the length. Avatars are small, so holding one in memory is fine; a
  // large upload would need a signed multipart flow rather than this relay.
  const body = await req.arrayBuffer().catch(() => null);
  if (!body) {
    return NextResponse.json(failureEnvelope('REQ_400', 'Unreadable body'), { status: 400 });
  }

  const upstream = await fetch(parsed, {
    method: 'PUT',
    body,
    headers: {
      'content-type': req.headers.get('content-type') ?? 'application/octet-stream',
      'content-length': String(body.byteLength),
    },
    cache: 'no-store',
  }).catch(() => null);

  if (!upstream) {
    return NextResponse.json(failureEnvelope('ERR_UPSTREAM', 'Storage unreachable'), {
      status: 502,
    });
  }

  return new NextResponse(null, { status: upstream.status });
}
