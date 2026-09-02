'use client';

import { useCallback, useState } from 'react';

import { mcpApi, rpcErrorOf, type McpTool, type ProbeResult } from '../api/mcp.api';

/**
 * Drives one connection attempt against an MCP server: initialize, then
 * `tools/list`, keeping the session id the server hands back.
 *
 * Not TanStack Query. There is no cached server state here — every run is a
 * fresh, deliberate action against a host the tester just typed, and caching one
 * would actively mislead: the whole question is "is it working *right now*".
 */
export interface ProbeStep {
  label: string;
  method: string;
  result: ProbeResult | null;
  error: string | null;
}

export function useMcpProbe() {
  const [steps, setSteps] = useState<ProbeStep[]>([]);
  const [tools, setTools] = useState<McpTool[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const record = useCallback((step: ProbeStep) => setSteps((current) => [...current, step]), []);

  /** One call, with the failure modes flattened into `error` for display. */
  const call = useCallback(
    async (
      label: string,
      method: string,
      url: string,
      token: string,
      params?: unknown,
      session?: string
    ): Promise<ProbeResult | null> => {
      try {
        const result = await mcpApi.call({
          url,
          token: token || undefined,
          method,
          params,
          sessionId: session,
        });

        // A 200 carrying a JSON-RPC error is still a failure — the transport
        // worked and the server refused. Surfacing that as success would hide
        // exactly the case a tester is looking for.
        const rpcError = rpcErrorOf(result);
        const httpError = result.status >= 400 ? `HTTP ${result.status}` : null;
        record({ label, method, result, error: rpcError ?? httpError });
        return rpcError || httpError ? null : result;
      } catch (error) {
        record({
          label,
          method,
          result: null,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        return null;
      }
    },
    [record]
  );

  const run = useCallback(
    async (url: string, token: string) => {
      setIsRunning(true);
      setSteps([]);
      setTools([]);
      setSessionId(null);

      try {
        const init = await call('initialize', 'initialize', url, token, {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'docs-hub-web probe', version: '1.0.0' },
        });
        if (!init) return;

        // Servers may or may not issue one; later calls must carry it if they do.
        const session = init.sessionId ?? undefined;
        setSessionId(init.sessionId);

        // Required by the lifecycle, and a server may refuse tools/list without
        // it. Its 202 has no body, so nothing is read back.
        await call(
          'notifications/initialized',
          'notifications/initialized',
          url,
          token,
          {},
          session
        );

        const listed = await call('tools/list', 'tools/list', url, token, {}, session);
        if (!listed) return;

        const result = (listed.payload as { result?: { tools?: McpTool[] } })?.result;
        setTools(result?.tools ?? []);
      } finally {
        setIsRunning(false);
      }
    },
    [call]
  );

  /** Invoke one advertised tool, reusing the session from the last run. */
  const callTool = useCallback(
    async (url: string, token: string, name: string, args: unknown) =>
      call(
        `tools/call · ${name}`,
        'tools/call',
        url,
        token,
        { name, arguments: args ?? {} },
        sessionId ?? undefined
      ),
    [call, sessionId]
  );

  return { steps, tools, sessionId, isRunning, run, callTool };
}
