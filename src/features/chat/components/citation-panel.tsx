'use client';

import { FileText, X } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { useI18n } from '@/core/i18n';
import { cn } from '@/shared/lib/utils';
import { IconButton } from '@/shared/ui';

import type { Citation } from '../schemas/chat.schema';
import { pageRangeOf } from '../services/citation.service';

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

  return (
    <aside className="border-border bg-surface-muted/40 hidden w-80 shrink-0 flex-col border-l lg:flex">
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
              {t('chat.citations.pages', { pages })}
            </p>

            {citations.map((citation) => (
              <div
                key={citation.index}
                ref={(node) => {
                  if (node) refs.current.set(citation.index, node);
                  else refs.current.delete(citation.index);
                }}
                className={cn(
                  'bg-surface mt-3 rounded-lg border p-3 text-sm leading-relaxed transition-colors',
                  citation.index === activeIndex
                    ? 'border-brand ring-brand/20 bg-brand-subtle/60 ring-[3px]'
                    : 'border-border text-muted-foreground'
                )}
              >
                <div className="text-brand mb-1 text-[11px] font-semibold">
                  [{citation.index}] · {t('chat.citations.page', { page: citation.page })}
                </div>
                {citation.excerpt}
              </div>
            ))}
          </>
        )}
      </div>
    </aside>
  );
}
