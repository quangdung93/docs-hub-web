'use client';

import { useEffect, useRef, useState } from 'react';
import { MessageSquarePlus, MessagesSquare, Trash2 } from 'lucide-react';

import { useI18n } from '@/core/i18n';
import { formatRelativeTime } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { ConfirmDialog, Skeleton } from '@/shared/ui';

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

  /** Right-click target: viewport coordinates plus the row it belongs to. */
  const [menu, setMenu] = useState<{ x: number; y: number; id: string } | null>(null);
  const [notice, setNotice] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Any click elsewhere, Escape, or a scroll dismisses the menu — it is
  // absolutely positioned, so scrolling would leave it floating over the wrong row.
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('pointerdown', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [menu]);

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
                  onContextMenu={(event) => {
                    event.preventDefault();
                    setMenu({ x: event.clientX, y: event.clientY, id: conversation.id });
                  }}
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

      {/* Fixed, not absolute: the list scrolls, and the menu must stay where the
          pointer opened it rather than travel with the row. */}
      {menu && (
        <div
          ref={menuRef}
          role="menu"
          style={{ left: menu.x, top: menu.y }}
          onPointerDown={(event) => event.stopPropagation()}
          className="border-border bg-surface fixed z-50 min-w-44 rounded-lg border p-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenu(null);
              setNotice(true);
            }}
            className="text-status-failed hover:bg-status-failed-bg/60 flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors"
          >
            <Trash2 className="size-3.5" aria-hidden />
            {t('chat.conversations.delete')}
          </button>
        </div>
      )}

      {/* Deliberately a dead end for now: docs-hub-api has no DELETE for a
          conversation, so the menu says what will exist rather than pretending. */}
      <ConfirmDialog
        open={notice}
        title={t('chat.conversations.delete')}
        description={t('common.comingSoon')}
        confirmLabel={t('common.done')}
        cancelLabel={t('common.cancel')}
        onConfirm={() => setNotice(false)}
        onCancel={() => setNotice(false)}
        variant="notice"
      />
    </aside>
  );
}
