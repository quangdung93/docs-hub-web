/**
 * Self-check for parsing an MCP response. Run with
 * `npx tsx src/features/mcp/api/mcp.api.test.ts`.
 *
 * Covers the case the probe exists to catch: a 200 whose body carries a
 * JSON-RPC error. Treating that as success is the one failure that would make
 * the whole page useless — it would report a broken server as working.
 */
import assert from 'node:assert/strict';

import { McpToolSchema, rpcErrorOf, type ProbeResult } from './mcp.api';

const result = (payload: unknown, status = 200): ProbeResult => ({
  status,
  contentType: 'application/json',
  sessionId: null,
  elapsedMs: 1,
  payload,
  raw: null,
});

// ── A JSON-RPC error inside a 200 is still an error ─────────────────────────
assert.equal(
  rpcErrorOf(result({ jsonrpc: '2.0', id: 1, error: { code: -32001, message: 'Unauthorized' } })),
  'Unauthorized'
);

// ── An error with no message still reports something usable ────────────────
assert.equal(
  rpcErrorOf(result({ jsonrpc: '2.0', id: 1, error: { code: -32601 } })),
  'JSON-RPC error -32601'
);

// ── A real result is not an error ───────────────────────────────────────────
assert.equal(rpcErrorOf(result({ jsonrpc: '2.0', id: 1, result: { tools: [] } })), null);

// ── A non-JSON-RPC body must not throw; it simply carries no rpc error ─────
assert.equal(rpcErrorOf(result('<html>502 Bad Gateway</html>')), null);
assert.equal(rpcErrorOf(result(null)), null);

// ── Tool parsing stays permissive: someone else's server defines this ──────
{
  const parsed = McpToolSchema.safeParse({
    name: 'get_document',
    description: 'Tải tài liệu',
    inputSchema: { type: 'object' },
    // A field the spec does not define must not fail the parse — rejecting a
    // slightly-off server hides exactly the fault we came to look at.
    somethingNew: true,
  });
  assert.ok(parsed.success, 'unknown fields must be tolerated');
  assert.equal(parsed.data.name, 'get_document');
}

// ── A tool with no name is genuinely unusable, so that does fail ───────────
assert.ok(!McpToolSchema.safeParse({ description: 'no name' }).success);

console.log('mcp.api self-check passed');
