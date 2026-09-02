import { type NextRequest, NextResponse } from 'next/server';

import { failureEnvelope, successEnvelope } from '@/core/api/errors';

/**
 * Server-side relay for one MCP JSON-RPC call.
 *
 * The page cannot talk to an MCP server directly: the CSP pins `connect-src` to
 * `'self'`, so a browser `fetch` to mcp.docshub.io.vn never leaves the tab.
 * Same shape as `/api/storage-put` — keep the browser same-origin and do the
 * cross-host hop here.
 *
 * This is a **probe**, not an MCP client. It forwards one request and returns
 * whatever came back, so the tester sees the server's real answer — including
 * its errors. It deliberately does not retry, follow redirects, or interpret
 * results: a tool that silently fixes things up cannot tell you the server is
 * broken.
 *
 * The bearer token is supplied per request by whoever is testing and is never
 * stored server-side. It is theirs, aimed at a host they name.
 */

/** Streamable HTTP requires both; a spec-compliant server rejects neither. */
const ACCEPT = 'application/json, text/event-stream';

/**
 * A server may answer a POST with an SSE stream instead of plain JSON — both are
 * legal. The probe issues one request at a time, so the first `data:` line
 * carries the response we asked for.
 */
function parseSse(body: string): unknown {
  for (const line of body.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) continue;
    try {
      return JSON.parse(trimmed.slice(5).trim());
    } catch {
      // Keep scanning: a comment or partial frame is not the payload.
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  let input: {
    url?: string;
    token?: string;
    method?: string;
    params?: unknown;
    sessionId?: string;
    protocolVersion?: string;
  };

  try {
    input = await req.json();
  } catch {
    return NextResponse.json(failureEnvelope('REQ_400', 'Body must be JSON'), { status: 400 });
  }

  const { url, token, method, params, sessionId, protocolVersion } = input;
  if (!url || !method) {
    return NextResponse.json(failureEnvelope('REQ_400', 'url and method are required'), {
      status: 400,
    });
  }

  // Only http(s), and never a bare hostname. Beyond that the host is the
  // tester's to choose: the whole point is pointing this at a server that does
  // not exist yet. It is an authenticated internal page, not a public endpoint.
  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return NextResponse.json(failureEnvelope('REQ_400', 'Malformed URL'), { status: 400 });
  }
  if (target.protocol !== 'https:' && target.protocol !== 'http:') {
    return NextResponse.json(failureEnvelope('REQ_400', 'URL must be http or https'), {
      status: 400,
    });
  }

  const headers: Record<string, string> = {
    'content-type': 'application/json',
    accept: ACCEPT,
    // Required from 2025-06-18 on; a server that does not get it assumes an
    // older version and may answer differently than the client expects.
    'mcp-protocol-version': protocolVersion ?? '2025-06-18',
  };
  if (token) headers.authorization = `Bearer ${token}`;
  // Assigned by the server during initialize; later calls are rejected without it.
  if (sessionId) headers['mcp-session-id'] = sessionId;

  const startedAt = Date.now();
  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        // Notifications carry no id and get 202 with no body.
        ...(method.startsWith('notifications/') ? {} : { id: 1 }),
        method,
        ...(params === undefined ? {} : { params }),
      }),
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    // DNS failure, refused connection and timeout are the three answers a tester
    // most needs to tell apart, so the reason is passed through rather than
    // flattened into "unreachable".
    const reason = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(failureEnvelope('MCP_UNREACHABLE', reason), { status: 502 });
  }

  const elapsedMs = Date.now() - startedAt;
  const contentType = upstream.headers.get('content-type') ?? '';
  const raw = await upstream.text().catch(() => '');

  let payload: unknown = null;
  if (contentType.includes('text/event-stream')) {
    payload = parseSse(raw);
  } else if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch {
      // Left null; `raw` is still returned so the tester can see what arrived —
      // an HTML error page from a misconfigured proxy is the usual culprit.
    }
  }

  return NextResponse.json(
    successEnvelope({
      status: upstream.status,
      contentType,
      // Echoed so the caller can carry it into subsequent calls.
      sessionId: upstream.headers.get('mcp-session-id'),
      elapsedMs,
      payload,
      raw: payload === null ? raw.slice(0, 4000) : null,
    })
  );
}
