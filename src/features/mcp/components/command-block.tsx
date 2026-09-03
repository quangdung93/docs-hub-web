'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

import { useI18n } from '@/core/i18n';
import { Button } from '@/shared/ui';

/**
 * A shell command with a copy button.
 *
 * The command is the deliverable here — someone has to paste it into a terminal
 * verbatim — so it is selectable text, not an image or a truncated preview, and
 * it wraps rather than scrolling out of sight.
 */
export function CommandBlock({ command, label }: { command: string; label?: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied; the text is on screen and selectable,
      // so there is nothing to recover from and nothing worth interrupting for.
    }
  };

  return (
    <div>
      {label && <p className="text-muted-foreground mb-1.5 text-xs font-medium">{label}</p>}
      <div className="border-border bg-surface-muted/50 flex items-start gap-2 rounded-lg border p-3">
        <code className="min-w-0 flex-1 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap">
          {command}
        </code>
        <Button variant="ghost" size="sm" onClick={() => void copy()} className="shrink-0">
          {copied ? (
            <Check className="size-3.5" aria-hidden />
          ) : (
            <Copy className="size-3.5" aria-hidden />
          )}
          {copied ? t('mcp.copied') : t('mcp.copy')}
        </Button>
      </div>
    </div>
  );
}
