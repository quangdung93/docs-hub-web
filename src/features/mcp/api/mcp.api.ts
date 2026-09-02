import { apiSuccessSchema } from '@/core/api';
import { http } from '@/shared/api/http';
import { z } from 'zod';

/**
 * Client transport for the MCP probe.
 *
 * Everything goes through `/api/mcp-probe`, which does the cross-host hop —
 * the CSP stops the browser reaching another origin, and this page's whole job
 * is reaching one.
 */

/** What the probe route reports back about a single call. */
export const ProbeResultSchema = z.object({
  status: z.number(),
  contentType: z.string(),
  sessionId: z.string().nullable(),
  elapsedMs: z.number(),
  payload: z.unknown(),
  raw: z.string().nullable(),
});

export type ProbeResult = z.infer<typeof ProbeResultSchema>;

/**
 * One tool as advertised by `tools/list`.
 *
 * Loosely typed on purpose: this describes *someone else's* server, and the
 * point of the page is to show what it actually returned. A strict schema would
 * reject a slightly-off server with a parse error instead of displaying it —
 * which is precisely the fault the tester came here to see.
 */
export const McpToolSchema = z.looseObject({
  name: z.string(),
  title: z.string().optional(),
  description: z.string().optional(),
  inputSchema: z.unknown().optional(),
});

export type McpTool = z.infer<typeof McpToolSchema>;

export interface ProbeInput {
  url: string;
  token?: string;
  method: string;
  params?: unknown;
  sessionId?: string;
}

export const mcpApi = {
  call: async (input: ProbeInput): Promise<ProbeResult> => {
    const { data } = await http.post('/mcp-probe', input);
    return apiSuccessSchema(ProbeResultSchema).parse(data).data;
  },
};

/** JSON-RPC envelope, as returned inside `payload`. */
export const JsonRpcSchema = z.looseObject({
  jsonrpc: z.string().optional(),
  id: z.unknown().optional(),
  result: z.unknown().optional(),
  error: z.looseObject({ code: z.number().optional(), message: z.string().optional() }).optional(),
});

/** Pulls the JSON-RPC error message out of a probe result, if there is one. */
export function rpcErrorOf(result: ProbeResult): string | null {
  const parsed = JsonRpcSchema.safeParse(result.payload);
  if (!parsed.success) return null;
  const { error } = parsed.data;
  if (!error) return null;
  return error.message ?? `JSON-RPC error ${error.code ?? ''}`.trim();
}
