'use client';

import { useMemo, useState } from 'react';

import { useI18n } from '@/core/i18n';
import { formatRelativeTime } from '@/shared/lib/format';
import { Badge, ErrorState, FileTypeIcon, Skeleton } from '@/shared/ui';

import { useDocuments, useVersionLabels } from '../hooks/use-documents';
import { formatBytes } from '../services/upload-queue.service';

import { DocumentDetailModal } from './document-detail-modal';
import { DocumentStatusBadge } from './document-status-badge';

/**
 * Every upload in the project as one timeline, newest first.
 *
 * Built entirely from the document list already in cache: `documentsApi.list`
 * fetches each document's detail to fill in the table columns, and that detail
 * carries the full revision array. So the change history costs no extra request
 * — it is a different view of data the table has already paid for.
 *
 * There is no history endpoint to use instead: `/projects/{id}/activities`,
 * `/audit-logs` and `/history` all 404 (verified 28/08/2026).
 *
 * Each entry is labelled Thêm mới or Cập nhật, derived from the revision number:
 * revision 1 created the document, anything above it replaced the file.
 *
 * Deletions cannot be shown. `DELETE /documents/{id}` removes the row outright —
 * it leaves the list, and fetching it by id answers 404 (verified 07/09/2026) —
 * so a deleted document leaves nothing for the client to read. The note at the
 * foot of the list says so, because a history that silently omits deletions
 * reads as complete when it is not.
 */
export function DocumentHistoryList({ projectId }: { projectId: string }) {
  const { t, locale } = useI18n();
  const { data: documents, isPending, isError, error, refetch } = useDocuments(projectId);
  const { labelOf } = useVersionLabels(projectId);
  const [openedId, setOpenedId] = useState<string | null>(null);

  const entries = useMemo(
    () =>
      (documents ?? [])
        .flatMap((document) =>
          document.history.map((revision) => ({
            ...revision,
            documentId: document.id,
            documentName: document.name,
            // Revision 1 is the upload that created the document; later ones
            // replaced its file.
            isFirst: revision.revisionNo === 1,
            // The newest revision of a document is the one the table shows.
            isCurrent: revision.id === document.revisionId,
          }))
        )
        .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)),
    [documents]
  );

  if (isPending) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-14" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        error={error}
        title={t('documents.loadError')}
        fallbackMessage={t('error.loadFailed')}
        retryLabel={t('common.retry')}
        onRetry={() => void refetch()}
        className="py-10"
      />
    );
  }

  if (entries.length === 0) {
    return <p className="text-muted-foreground py-10 text-center text-sm">{t('history.empty')}</p>;
  }

  return (
    <div className="space-y-2">
      <p className="text-muted-foreground text-xs">{t('history.hint')}</p>

      {entries.map((entry) => {
        const versionLabel = labelOf(entry.projectVersionId);
        return (
          <button
            type="button"
            key={entry.id}
            onClick={() => setOpenedId(entry.documentId)}
            className="border-border hover:bg-accent/40 focus-visible:ring-ring/40 flex w-full items-center justify-between gap-3 rounded-lg border p-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <FileTypeIcon fileName={entry.fileName} />
              <div className="min-w-0 leading-tight">
                <div className="flex items-center gap-2">
                  {/* Revision 1 created the document; anything above replaced
                      its file. Deletions cannot appear — see the note below. */}
                  <Badge variant={entry.isFirst ? 'indexed' : 'brand'} className="shrink-0">
                    {entry.isFirst ? t('history.action.added') : t('history.action.updated')}
                  </Badge>
                  <span className="truncate text-sm font-medium">{entry.documentName}</span>
                </div>
                <div className="text-muted-foreground truncate text-xs">
                  <span className="text-muted-foreground font-normal">
                    {t('history.revision', { no: entry.revisionNo })}
                  </span>
                </div>
                <div className="text-muted-foreground mt-0.5 text-xs">
                  {formatRelativeTime(entry.uploadedAt, locale)} · {formatBytes(entry.sizeBytes)}
                  {versionLabel && ` · ${versionLabel}`}
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <DocumentStatusBadge status={entry.status} />
            </div>
          </button>
        );
      })}

      {/* Says what the list cannot show, so its silence is not read as "nothing
          was ever deleted". */}
      <p className="text-muted-foreground pt-1 text-xs italic">{t('history.deletedNote')}</p>

      <DocumentDetailModal
        projectId={projectId}
        document={(documents ?? []).find((item) => item.id === openedId) ?? null}
        initialTab="history"
        onClose={() => setOpenedId(null)}
      />
    </div>
  );
}
