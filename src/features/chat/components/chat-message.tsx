'use client';

import { Sparkles } from 'lucide-react';
import { Fragment } from 'react';

import { useI18n } from '@/core/i18n';

import type { ChatMessage as ChatMessageModel } from '../schemas/chat.schema';
import { parseAnswer } from '../services/citation.service';

/**
 * One chat turn. User messages are a plain bubble; assistant messages render the
 * answer with clickable `[n]` markers plus the source chip row underneath. Both
 * marker and chip call `onCitationSelect`, so the source panel has a single entry
 * point regardless of which affordance the user clicks.
 */
export function ChatMessage({
  message,
  onCitationSelect,
}: {
  message: ChatMessageModel;
  onCitationSelect: (index: number) => void;
}) {
  const { t } = useI18n();

  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="bg-brand max-w-[80%] rounded-2xl rounded-br-sm px-4 py-2.5 text-sm break-words text-white">
          {message.content}
        </div>
      </div>
    );
  }

  const validIndexes = message.citations.map((citation) => citation.index);
  const segments = parseAnswer(message.content, validIndexes);

  return (
    <div className="flex gap-3">
      <span className="bg-brand-subtle text-brand grid size-8 shrink-0 place-items-center rounded-full">
        <Sparkles className="size-4" aria-hidden />
      </span>

      <div className="max-w-[85%] space-y-3">
        <div className="border-border bg-surface rounded-2xl rounded-tl-sm border px-4 py-3 text-sm leading-relaxed whitespace-pre-line">
          {segments.map((segment, position) =>
            segment.kind === 'text' ? (
              <Fragment key={position}>{segment.value}</Fragment>
            ) : (
              <button
                key={position}
                type="button"
                onClick={() => onCitationSelect(segment.index)}
                className="text-brand focus-visible:ring-ring/40 cursor-pointer align-super text-[11px] font-semibold hover:underline focus-visible:ring-2 focus-visible:outline-none"
              >
                [{segment.index}]
              </button>
            )
          )}
        </div>

        {message.citations.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground text-xs">{t('chat.sources')}</span>
            {message.citations.map((citation) => (
              <button
                key={citation.index}
                type="button"
                onClick={() => onCitationSelect(citation.index)}
                className="border-border bg-surface-muted text-muted-foreground hover:border-brand/40 focus-visible:ring-ring/40 inline-flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                <span className="text-brand font-semibold">{citation.index}</span>
                {citation.documentName}
                {citation.page === undefined
                  ? null
                  : ` · ${t('chat.citations.page', { page: citation.page })}`}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
