'use client';

import { useState } from 'react';
import { CheckCircle2, Plug, XCircle } from 'lucide-react';

import { useI18n } from '@/core/i18n';
import { Badge, Button, Card, CardBody, CardHeader, CardTitle, Field, Input } from '@/shared/ui';

import { useMcpProbe } from '../hooks/use-mcp-probe';

import { CommandBlock } from './command-block';
import { ToolCaller } from './tool-caller';

/**
 * Test harness for an MCP server, and the install commands for it.
 *
 * Two jobs on one screen because they are the same task from two ends: confirm
 * the server answers, then hand someone the command that points Claude Code at
 * it. Splitting them would mean typing the URL twice.
 *
 * The URL and name persist to `localStorage`; the token deliberately does not.
 * A bearer token left in web storage outlives the tab and is readable by any
 * script on the origin — the same reason this app keeps its own session in an
 * httpOnly cookie. Retyping it per session is the correct cost.
 */
const STORAGE_KEY = 'docs-hub:mcp-tester';

const DEFAULT_URL = 'https://mcp.docshub.io.vn/mcp';
const DEFAULT_NAME = 'docshub';

export function McpTesterScreen() {
  const { t } = useI18n();
  const { steps, tools, sessionId, isRunning, run, callTool } = useMcpProbe();

  const [url, setUrl] = useState(() => readStored('url') ?? DEFAULT_URL);
  const [name, setName] = useState(() => readStored('name') ?? DEFAULT_NAME);
  const [token, setToken] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);

  const persist = (next: { url?: string; name?: string }) => {
    if (typeof window === 'undefined') return;
    const current = { url, name, ...next };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  };

  const connect = () => {
    if (!url.trim()) {
      setUrlError(t('mcp.urlRequired'));
      return;
    }
    setUrlError(null);
    persist({});
    void run(url.trim(), token.trim());
  };

  const addCommand = [
    'claude mcp add --transport http',
    name.trim() || DEFAULT_NAME,
    url.trim() || DEFAULT_URL,
    token.trim() ? `--header "Authorization: Bearer ${token.trim()}"` : '',
  ]
    .filter(Boolean)
    .join(' ');

  const removeCommand = `claude mcp remove ${name.trim() || DEFAULT_NAME}`;

  return (
    <main className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">{t('mcp.title')}</h1>
        <p className="text-muted-foreground mt-0.5 text-sm">{t('mcp.subtitle')}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('mcp.title')}</CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
            <Field label={t('mcp.serverUrl')} htmlFor="mcp-url" error={urlError ?? undefined}>
              <Input
                id="mcp-url"
                value={url}
                placeholder={DEFAULT_URL}
                autoComplete="off"
                spellCheck={false}
                onChange={(event) => {
                  setUrl(event.target.value);
                  if (urlError) setUrlError(null);
                }}
                onBlur={() => persist({ url })}
              />
              <p className="text-muted-foreground mt-1 text-xs">{t('mcp.serverUrlHint')}</p>
            </Field>

            <Field label={t('mcp.token')} htmlFor="mcp-token">
              <Input
                id="mcp-token"
                type="password"
                value={token}
                autoComplete="off"
                spellCheck={false}
                onChange={(event) => setToken(event.target.value)}
              />
              <p className="text-muted-foreground mt-1 text-xs">{t('mcp.tokenHint')}</p>
            </Field>

            <Field label={t('mcp.serverName')} htmlFor="mcp-name">
              <Input
                id="mcp-name"
                value={name}
                autoComplete="off"
                spellCheck={false}
                onChange={(event) => setName(event.target.value)}
                onBlur={() => persist({ name })}
              />
              <p className="text-muted-foreground mt-1 text-xs">{t('mcp.serverNameHint')}</p>
            </Field>

            <Button onClick={connect} disabled={isRunning}>
              <Plug aria-hidden />
              {isRunning ? t('mcp.connecting') : t('mcp.connect')}
            </Button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('mcp.install')}</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            <p className="text-muted-foreground text-xs">{t('mcp.installHint')}</p>
            <CommandBlock command={addCommand} />
            <CommandBlock command={removeCommand} label={t('mcp.remove')} />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('mcp.steps')}</CardTitle>
        </CardHeader>
        <CardBody>
          {steps.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">{t('mcp.noRun')}</p>
          ) : (
            <div className="space-y-2">
              {steps.map((step, index) => (
                <div
                  key={`${step.method}-${index}`}
                  className="border-border flex items-start justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="flex min-w-0 items-start gap-2.5">
                    {step.error ? (
                      <XCircle className="text-status-failed mt-0.5 size-4 shrink-0" aria-hidden />
                    ) : (
                      <CheckCircle2
                        className="text-status-indexed mt-0.5 size-4 shrink-0"
                        aria-hidden
                      />
                    )}
                    <div className="min-w-0">
                      <div className="font-mono text-sm">{step.label}</div>
                      {step.error && (
                        <p className="text-status-failed mt-0.5 text-xs break-words">
                          {step.error}
                        </p>
                      )}
                      {step.result?.raw && (
                        <pre className="text-muted-foreground scroll-thin mt-1 max-h-24 overflow-auto font-mono text-[11px]">
                          {step.result.raw}
                        </pre>
                      )}
                    </div>
                  </div>

                  {step.result && (
                    <div className="text-muted-foreground shrink-0 text-right text-xs">
                      <div>
                        {t('mcp.status')} {step.result.status}
                      </div>
                      <div>{step.result.elapsedMs} ms</div>
                    </div>
                  )}
                </div>
              ))}

              <p className="text-muted-foreground pt-1 text-xs">
                {t('mcp.session')}:{' '}
                <span className="font-mono">{sessionId ?? t('mcp.noSession')}</span>
              </p>
            </div>
          )}
        </CardBody>
      </Card>

      {steps.length > 0 && !isRunning && (
        <Card>
          <CardHeader>
            <CardTitle>{t('mcp.tools')}</CardTitle>
            {tools.length > 0 && <Badge variant="brand">{tools.length}</Badge>}
          </CardHeader>
          <CardBody>
            {tools.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-sm">
                {t('mcp.toolsEmpty')}
              </p>
            ) : (
              <div className="space-y-2">
                {tools.map((tool) => (
                  <ToolCaller
                    key={tool.name}
                    tool={tool}
                    disabled={isRunning}
                    onCall={(args) => callTool(url.trim(), token.trim(), tool.name, args)}
                  />
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      )}
    </main>
  );
}

/** Lazy read of a persisted field; absent or corrupt storage falls back. */
function readStored(field: 'url' | 'name'): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return typeof parsed[field] === 'string' ? (parsed[field] as string) : null;
  } catch {
    return null;
  }
}
