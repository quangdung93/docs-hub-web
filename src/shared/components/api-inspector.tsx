'use client';

import { useState, useSyncExternalStore } from 'react';
import { Code2, Copy, Trash2, X } from 'lucide-react';

import {
  type ApiLogEntry,
  clearApiLog,
  getApiLog,
  subscribeApiLog,
  toCurl,
} from '@/shared/api/api-log';
import { cn } from '@/shared/lib/utils';

/**
 * Floating API inspector — every call the client makes, with a replayable curl
 * and the response body, without opening devtools.
 *
 * ponytail: reads the module-level log directly instead of a context/store.
 * Nothing else consumes it, and the panel is the only reader.
 */
function statusTone(entry: ApiLogEntry): string {
  if (entry.status === undefined) return 'bg-muted text-muted-foreground';
  if (entry.status >= 500) return 'bg-red-500/15 text-red-500';
  if (entry.status >= 400) return 'bg-amber-500/15 text-amber-600 dark:text-amber-400';
  return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400';
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="border-border text-muted-foreground hover:bg-accent inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs"
    >
      <Copy className="size-3" aria-hidden />
      {copied ? 'Đã copy' : label}
    </button>
  );
}

function EntryDetail({ entry }: { entry: ApiLogEntry }) {
  return (
    <div className="border-border bg-muted/30 space-y-3 border-t p-3">
      <section className="space-y-1">
        <div className="flex items-center justify-between">
          <h4 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            curl
          </h4>
          <CopyButton text={toCurl(entry)} label="Copy curl" />
        </div>
        <pre className="bg-background overflow-x-auto rounded p-2 text-[11px] leading-relaxed">
          {toCurl(entry)}
        </pre>
      </section>

      {entry.formParts && (
        <section className="space-y-1">
          <h4 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Form data
          </h4>
          <pre className="bg-background overflow-x-auto rounded p-2 text-[11px]">
            {entry.formParts.map((part) => `${part.name} = ${part.value}`).join('\n')}
          </pre>
        </section>
      )}

      {entry.requestBody && (
        <section className="space-y-1">
          <h4 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Request body
          </h4>
          <pre className="bg-background max-h-48 overflow-auto rounded p-2 text-[11px]">
            {entry.requestBody}
          </pre>
        </section>
      )}

      <section className="space-y-1">
        <div className="flex items-center justify-between">
          <h4 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Response
          </h4>
          {entry.responseBody && <CopyButton text={entry.responseBody} label="Copy" />}
        </div>
        <pre className="bg-background max-h-64 overflow-auto rounded p-2 text-[11px]">
          {entry.responseBody || entry.error || '(đang chờ…)'}
        </pre>
      </section>
    </div>
  );
}

export function ApiInspector() {
  const [open, setOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const entries = useSyncExternalStore(subscribeApiLog, getApiLog, () => getApiLog());

  const failures = entries.filter((entry) => entry.status && entry.status >= 400).length;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="API inspector"
        className="bg-primary text-primary-foreground fixed right-4 bottom-4 z-50 flex size-11 items-center justify-center rounded-full shadow-lg transition hover:opacity-90"
      >
        <Code2 className="size-5" aria-hidden />
        {failures > 0 && (
          <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-medium text-white">
            {failures}
          </span>
        )}
      </button>

      {open && (
        <aside className="border-border bg-background fixed right-4 bottom-20 z-50 flex max-h-[70vh] w-[min(38rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-lg border shadow-2xl">
          <header className="border-border flex items-center justify-between border-b px-3 py-2">
            <div className="text-sm font-medium">
              API calls
              <span className="text-muted-foreground ml-2 text-xs">{entries.length}</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={clearApiLog}
                className="text-muted-foreground hover:bg-accent rounded p-1"
                aria-label="Xoá log"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:bg-accent rounded p-1"
                aria-label="Đóng"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
          </header>

          <div className="overflow-y-auto">
            {entries.length === 0 ? (
              <p className="text-muted-foreground p-6 text-center text-sm">
                Chưa có request nào. Thao tác trên trang để xem.
              </p>
            ) : (
              entries.map((entry) => (
                <div key={entry.id} className="border-border border-b last:border-0">
                  <button
                    type="button"
                    onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                    className="hover:bg-accent/50 flex w-full items-center gap-2 px-3 py-2 text-left"
                  >
                    <span className="text-muted-foreground w-14 shrink-0 font-mono text-[11px] font-medium">
                      {entry.method}
                    </span>
                    <span
                      className={cn(
                        'w-11 shrink-0 rounded px-1 text-center font-mono text-[11px]',
                        statusTone(entry)
                      )}
                    >
                      {entry.status ?? '···'}
                    </span>
                    <span className="flex-1 truncate font-mono text-[11px]">{entry.url}</span>
                    <span className="text-muted-foreground shrink-0 text-[11px]">
                      {entry.durationMs === undefined ? '' : `${entry.durationMs}ms`}
                    </span>
                  </button>
                  {expandedId === entry.id && <EntryDetail entry={entry} />}
                </div>
              ))
            )}
          </div>
        </aside>
      )}
    </>
  );
}
