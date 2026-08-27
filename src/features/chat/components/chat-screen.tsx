'use client';

import { ArrowLeft, Folder, FolderCog, Loader2, MessagesSquare } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';

import { useI18n } from '@/core/i18n';
import { orUnknown } from '@/shared/lib/format';
import { useProject } from '@/features/projects';
import { projectRoutes } from '@/features/projects/routes';
import { Button, Card, EmptyState, IconButton, Skeleton } from '@/shared/ui';

import { useChat } from '../hooks/use-chat';

import { ChatComposer } from './chat-composer';
import { ChatMessage } from './chat-message';
import { CitationPanel } from './citation-panel';
import { ConversationList } from './conversation-list';

/**
 * Q&A screen: transcript on the left, cited sources on the right. The active
 * citation lives here (not in either child) because both the message list and the
 * panel need it — clicking `[1]` in a bubble highlights the excerpt in the panel.
 */
export function ChatScreen({ projectId }: { projectId: string }) {
  const { t } = useI18n();
  const { data: project } = useProject(projectId);
  const {
    conversationId,
    setConversationId,
    messages,
    isLoading,
    ask: askQuestion,
  } = useChat(projectId);

  const [activeCitation, setActiveCitation] = useState<number | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const transcriptRef = useRef<HTMLDivElement>(null);

  // Citations of the most recent assistant answer drive the source panel.
  const citations = useMemo(() => {
    const answers = messages.filter((message) => message.role === 'assistant');
    return answers.at(-1)?.citations ?? [];
  }, [messages]);

  // Keep the newest turn in view as the transcript grows.
  useEffect(() => {
    const node = transcriptRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages, askQuestion.isPending]);

  const selectCitation = (index: number) => {
    setPanelOpen(true);
    setActiveCitation(index);
  };

  /**
   * Switching conversations must clear the highlighted citation: the index is
   * positional, so a stale `[2]` would light up an unrelated excerpt in the new
   * transcript.
   */
  const selectConversation = (id: string | null) => {
    setActiveCitation(null);
    setConversationId(id);
  };

  return (
    <>
      <Card>
        <div className="flex h-[640px]">
          <ConversationList
            projectId={projectId}
            activeId={conversationId}
            onSelect={selectConversation}
          />

          <main className="flex min-w-0 flex-1 flex-col">
            <div className="border-border flex items-center justify-between gap-3 border-b px-5 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <IconButton
                  icon={ArrowLeft}
                  label={t('common.back')}
                  onClick={() => history.back()}
                />
                <div className="min-w-0 leading-tight">
                  <div className="truncate text-sm font-semibold tracking-tight">
                    {t('chat.title')}
                  </div>
                  <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                    <Folder className="size-3.5 shrink-0" aria-hidden />
                    <span className="truncate">
                      {project?.name}
                      {project &&
                        ` · ${t('documents.count', { count: orUnknown(project.documentCount) })}`}
                    </span>
                  </div>
                </div>
              </div>

              <Button asChild variant="outline" size="sm">
                <Link href={projectRoutes.documents(projectId)}>
                  <FolderCog aria-hidden />
                  {t('chat.manageProject')}
                </Link>
              </Button>
            </div>

            <div
              ref={transcriptRef}
              className="scroll-thin flex-1 space-y-6 overflow-y-auto px-5 py-6"
            >
              {isLoading && (
                <>
                  <Skeleton className="ml-auto h-12 w-2/3 rounded-2xl" />
                  <Skeleton className="h-28 w-5/6 rounded-2xl" />
                </>
              )}

              {!isLoading && messages.length === 0 && (
                <EmptyState
                  icon={MessagesSquare}
                  title={t('chat.empty.title')}
                  description={t('chat.empty.description')}
                />
              )}

              {!isLoading &&
                messages.map((message) => (
                  <ChatMessage
                    key={message.id}
                    message={message}
                    onCitationSelect={selectCitation}
                  />
                ))}

              {askQuestion.isPending && (
                <div className="text-muted-foreground flex items-center gap-2 text-sm">
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  {t('chat.thinking')}
                </div>
              )}

              {askQuestion.isError && (
                <p role="alert" className="text-status-failed text-sm">
                  {t('chat.error')}
                </p>
              )}
            </div>

            <ChatComposer
              onSubmit={(question) => askQuestion.mutate(question)}
              pending={askQuestion.isPending}
            />
          </main>

          {panelOpen && (
            <CitationPanel
              citations={citations}
              activeIndex={activeCitation}
              onClose={() => setPanelOpen(false)}
            />
          )}
        </div>
      </Card>

      <p className="text-muted-foreground mt-3 text-center text-xs">{t('chat.footnote')}</p>
    </>
  );
}
