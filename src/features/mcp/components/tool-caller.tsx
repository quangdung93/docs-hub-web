'use client';

import { useState } from 'react';
import { Play } from 'lucide-react';

import { useI18n } from '@/core/i18n';
import { Button, Field, Textarea } from '@/shared/ui';

import { type McpTool, type ProbeResult } from '../api/mcp.api';

/**
 * One advertised tool, expandable into a form that calls it.
 *
 * Arguments are free-form JSON rather than a form generated from `inputSchema`.
 * The schema comes from a server that may itself be wrong — generating inputs
 * from it would quietly constrain the tester to whatever the server claims,
 * when the point is to send it anything and see what happens.
 */
export function ToolCaller({
  tool,
  onCall,
  disabled,
}: {
  tool: McpTool;
  onCall: (args: unknown) => Promise<ProbeResult | null>;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [args, setArgs] = useState('{}');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProbeResult | null>(null);
  const [isCalling, setIsCalling] = useState(false);

  const run = async () => {
    let parsed: unknown;
    try {
      parsed = args.trim() ? JSON.parse(args) : {};
    } catch {
      setError(t('mcp.invalidJson'));
      return;
    }
    setError(null);
    setIsCalling(true);
    try {
      setResult(await onCall(parsed));
    } finally {
      setIsCalling(false);
    }
  };

  return (
    <div className="border-border rounded-lg border p-3">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-start justify-between gap-3 text-left"
      >
        <div className="min-w-0">
          <div className="font-mono text-sm font-medium">{tool.name}</div>
          {(tool.title || tool.description) && (
            <p className="text-muted-foreground mt-0.5 text-xs">{tool.description ?? tool.title}</p>
          )}
        </div>
        <span className="text-muted-foreground shrink-0 text-xs">{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <Field label={t('mcp.arguments')} error={error ?? undefined}>
            <Textarea
              rows={3}
              value={args}
              onChange={(event) => {
                setArgs(event.target.value);
                if (error) setError(null);
              }}
              className="font-mono text-xs"
            />
          </Field>

          {/* The schema is shown as-is so the tester can see what to send —
              including when it is malformed. */}
          {tool.inputSchema !== undefined && (
            <pre className="border-border bg-surface-muted/40 scroll-thin max-h-32 overflow-auto rounded-md border p-2 font-mono text-[11px]">
              {JSON.stringify(tool.inputSchema, null, 2)}
            </pre>
          )}

          <Button size="sm" onClick={() => void run()} disabled={disabled || isCalling}>
            <Play className="size-3.5" aria-hidden />
            {t('mcp.callTool')}
          </Button>

          {result && (
            <div>
              <p className="text-muted-foreground mb-1 text-xs font-medium">{t('mcp.response')}</p>
              <pre className="border-border bg-surface-muted/40 scroll-thin max-h-64 overflow-auto rounded-md border p-2 font-mono text-[11px]">
                {JSON.stringify(result.payload ?? result.raw, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
