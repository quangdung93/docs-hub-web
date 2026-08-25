'use client';

import { MessageSquarePlus, MessagesSquare } from 'lucide-react';

import { useI18n } from '@/core/i18n';
import { formatRelativeTime } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { Skeleton } from '@/shared/ui';

import { useConversations } from '../hooks/use-chat';

/**
 * Past conversations, newest first.
 *
 * The backend has persisted every turn since the chat module shipped, but
 * nothing in the UI read it back — opening the screen always started from an
 * empty transcript while the history sat on the server. This is that list.
 *
 * `null` is the "new conversation" selection: the conversation itself is not
 * created until the first question, so an unused one never reaches the server.
 */
export function ConversationList({
  projectId,
  activeId,
  onSelect,
}: {
  projectId: string;
  activeId: string | null;
  onSelect: (conversationId: string | null) => void;
}) {
  const { t, locale } = useI18n();
  const { data: conversations, isPending } = useConversations(projectId);

  return (
    <aside className="border-border bg-surface-muted/30 hidden w-60 shrink-0 flex-col border-r lg:flex">
      <div className="border-border border-b p-2">
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={cn(
            'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors',
            activeId === null
              ? 'bg-brand-subtle text-brand font-medium'
              : 'text-muted-foreground hover:bg-accent'
          )}
        >
          <MessageSquarePlus className="size-4 shrink-0" aria-hidden />
          {t('chat.conversations.new')}
        </button>
      </div>

      <div className="scroll-thin flex-1 overflow-y-auto p-2">
        {isPending ? (
          <div className="space-y-2 p-1">
            <Skeleton className="h-8" />
            <Skeleton className="h-8" />
            <Skeleton className="h-8" />
          </div>
        ) : !conversations?.length ? (
          <p className="text-muted-foreground px-2.5 py-6 text-center text-xs">
            {t('chat.conversations.empty')}
          </p>
        ) : (
          <ul className="space-y-0.5">
            {conversations.map((conversation) => (
              <li key={conversation.id}>
                <button
                  type="button"
                  onClick={() => onSelect(conversation.id)}
                  className={cn(
                    'w-full rounded-md px-2.5 py-2 text-left transition-colors',
                    conversation.id === activeId ? 'bg-brand-subtle text-brand' : 'hover:bg-accent'
                  )}
                >
                  <span className="flex items-center gap-2">
                    <MessagesSquare className="size-3.5 shrink-0 opacity-60" aria-hidden />
                    {/* Titles are the first question verbatim, so they run long
                        and repeat — truncation is what keeps the list scannable. */}
                    <span className="truncate text-sm">
                      {conversation.title || t('chat.conversations.untitled')}
                    </span>
                  </span>
                  <span className="text-muted-foreground mt-0.5 block pl-5.5 text-[11px]">
                    {formatRelativeTime(conversation.updatedAt, locale)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
