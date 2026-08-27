'use client';

import { FileText, X } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { useI18n } from '@/core/i18n';
import { cn } from '@/shared/lib/utils';
import { IconButton } from '@/shared/ui';

import type { Citation } from '../schemas/chat.schema';
import { useResizablePanel } from '../hooks/use-resizable-panel';
import { looksLikeCode, pageRangeOf } from '../services/citation.service';

/**
 * Source sidebar. The active citation is highlighted and scrolled into view —
 * that scroll is why each excerpt keeps a ref rather than being a plain list.
 */
export function CitationPanel({
  citations,
  activeIndex,
  onClose,
}: {
  citations: readonly Citation[];
  activeIndex: number | null;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const refs = useRef(new Map<number, HTMLDivElement>());

  useEffect(() => {
    if (activeIndex === null) return;
    refs.current.get(activeIndex)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [activeIndex]);

  const documentName = citations[0]?.documentName;
  const pages = pageRangeOf(citations.map((citation) => citation.page));
  // The backend returns null page bounds for every format seen so far, which
  // would leave "Pages  · relevant passages" hanging. Fall back to the version
  // the chunks came from — that is what actually locates them.
  const scopeLabel = citations[0]?.scopeLabel;
  const { width, isDragging, startDrag, nudge, min, max } = useResizablePanel();

  return (
    <aside
      className="border-border bg-surface-muted/40 relative hidden shrink-0 flex-col border-l lg:flex"
      style={{ width }}
    >
      {/* Drag handle. Sits just outside the border and is only tinted on hover,
          so it reads as an affordance without drawing a second visible line. */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={t('chat.citations.resize')}
        aria-valuenow={width}
        aria-valuemin={min}
        aria-valuemax={max}
        tabIndex={0}
        onPointerDown={(event) => {
          event.preventDefault();
          startDrag();
        }}
        onKeyDown={(event) => {
          // Arrows only: the panel is docked right, so left widens it.
          if (event.key === 'ArrowLeft') nudge(24);
          else if (event.key === 'ArrowRight') nudge(-24);
          else return;
          event.preventDefault();
        }}
        className={cn(
          'absolute top-0 -left-1 z-10 h-full w-2 cursor-col-resize',
          'hover:bg-brand/30 focus-visible:bg-brand/40 focus-visible:outline-none',
          isDragging && 'bg-brand/40'
        )}
      />

      <div className="border-border flex items-center justify-between border-b px-4 py-3">
        <span className="text-sm font-medium">{t('chat.citations.title')}</span>
        <IconButton icon={X} size="sm" label={t('chat.citations.close')} onClick={onClose} />
      </div>

      <div className="scroll-thin flex-1 overflow-y-auto p-4">
        {citations.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t('chat.citations.empty')}</p>
        ) : (
          <>
            <div className="flex items-center gap-2 text-sm">
              <FileText className="text-brand size-4" aria-hidden />
              <span className="truncate font-medium">{documentName}</span>
            </div>
            <p className="text-muted-foreground mt-1 text-xs">
              {pages
                ? t('chat.citations.pages', { pages })
                : t('chat.citations.source', { scope: scopeLabel ?? '—' })}
            </p>

            {citations.map((citation) => (
              <div
                key={citation.index}
                ref={(node) => {
                  if (node) refs.current.set(citation.index, node);
                  else refs.current.delete(citation.index);
                }}
                className={cn(
                  // `break-words`: excerpts are raw document text, and an XML
                  // attribute or a long URL has no break opportunity — without it
                  // the string overflows the panel and gets clipped mid-word.
                  'bg-surface mt-3 rounded-lg border p-3 text-sm leading-relaxed break-words transition-colors',
                  citation.index === activeIndex
                    ? 'border-brand ring-brand/20 bg-brand-subtle/60 ring-[3px]'
                    : 'border-border text-muted-foreground'
                )}
              >
                <div className="text-brand mb-1 text-[11px] font-semibold">
                  [{citation.index}]
                  {citation.page === undefined
                    ? null
                    : ` · ${t('chat.citations.page', { page: citation.page })}`}
                </div>
                {/* `whitespace-pre-wrap` keeps the document's own line breaks and
                    indentation. Without it every newline collapses and the whole
                    excerpt renders as one unreadable paragraph. */}
                <div
                  className={cn(
                    'whitespace-pre-wrap',
                    looksLikeCode(citation.excerpt) &&
                      'bg-surface-muted/60 overflow-x-auto rounded px-2 py-1.5 font-mono text-xs'
                  )}
                >
                  {citation.excerpt}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </aside>
  );
}
