import { type NextRequest, NextResponse } from 'next/server';

import { failureEnvelope } from '@/core/api/errors';

/**
 * Server-side relay for a presigned storage GET — the read counterpart of
 * `storage-put`.
 *
 * Generated reports live in object storage and the API hands back a presigned
 * URL rather than the bytes. The browser cannot follow it: `connect-src 'self'`
 * blocks the fetch before it leaves the page. (Storage itself does send CORS
 * headers — the block is ours, and deliberate.) Relaying keeps the browser
 * same-origin, exactly like the rest of the BFF.
 *
 * Fetching rather than redirecting is what makes the download nameable: a
 * redirect hands the browser a cross-origin response, where `<a download>` is
 * ignored and the saved file takes its name from the UUID object key. Coming
 * back through this route the response is same-origin, so `Content-Disposition`
 * below decides the filename.
 *
 * The URL is already signed, so no credentials are attached — the signature is
 * the authorisation, and it expires in 15 minutes.
 */
const ALLOWED_HOSTS = new Set(['storage.docshub.io.vn']);

export async function GET(req: NextRequest) {
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

  const upstream = await fetch(parsed, { cache: 'no-store' }).catch(() => null);
  if (!upstream) {
    return NextResponse.json(failureEnvelope('ERR_UPSTREAM', 'Storage unreachable'), {
      status: 502,
    });
  }
  if (!upstream.ok) {
    // A signature older than 15 minutes answers 403 here. Passing the status
    // through lets the caller say "link expired" instead of saving the error
    // body as a spreadsheet.
    return NextResponse.json(failureEnvelope('ERR_UPSTREAM', 'Storage rejected the link'), {
      status: upstream.status,
    });
  }

  // The filename comes from the caller, not from storage — storage sends no
  // Content-Disposition and its object key is a bare UUID. Quoted and stripped
  // of quotes/newlines so a crafted name cannot inject extra header fields.
  const requested = req.nextUrl.searchParams
    .get('filename')
    ?.replace(/["\r\n]/g, '')
    .trim();
  const fileName = requested || 'report';

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      'content-type': upstream.headers.get('content-type') ?? 'application/octet-stream',
      'content-disposition': `attachment; filename="${fileName}"`,
      'cache-control': 'no-store',
    },
  });
}
