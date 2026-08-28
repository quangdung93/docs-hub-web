'use client';

import { useMemo } from 'react';

import { useI18n } from '@/core/i18n';
import { formatRelativeTime } from '@/shared/lib/format';
import { ErrorState, FileTypeIcon, Skeleton } from '@/shared/ui';

import { useDocuments, useVersionLabels } from '../hooks/use-documents';
import { formatBytes } from '../services/upload-queue.service';

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
 * `/audit-logs` and `/history` all 404 (verified 28/08/2026). The consequence is
 * that this shows document uploads only, not renames, deletions or membership
 * changes — those leave no trace the client can read.
 */
export function DocumentHistoryList({ projectId }: { projectId: string }) {
  const { t, locale } = useI18n();
  const { data: documents, isPending, isError, error, refetch } = useDocuments(projectId);
  const { labelOf } = useVersionLabels(projectId);

  const entries = useMemo(
    () =>
      (documents ?? [])
        .flatMap((document) =>
          document.history.map((revision) => ({
            ...revision,
            documentId: document.id,
            documentName: document.name,
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
          <div
            key={entry.id}
            className="border-border hover:bg-accent/40 flex items-center justify-between gap-3 rounded-lg border p-2.5 transition-colors"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <FileTypeIcon fileName={entry.fileName} />
              <div className="min-w-0 leading-tight">
                <div className="truncate text-sm font-medium">
                  {entry.documentName}{' '}
                  <span className="text-muted-foreground font-normal">
                    · {t('history.revision', { no: entry.revisionNo })}
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
          </div>
        );
      })}
    </div>
  );
}
