'use client';

import { useEffect } from 'react';
import { AlertCircle, CheckCircle2, Loader2, X } from 'lucide-react';

import { useI18n } from '@/core/i18n';
import { cn } from '@/shared/lib/utils';
import { Button, FileTypeIcon, IconButton, Progress } from '@/shared/ui';

import { useRetryRevision, useRevisionStatus } from '../hooks/use-documents';
import { type UploadItem, formatBytes, isRejected } from '../services/upload-queue.service';

import { IngestionSteps } from './ingestion-steps';

/**
 * One row of the processing queue. Each status renders a different trailing
 * element — a check, a spinner, a determinate bar, or an error hint — which is
 * why this is a component rather than four copies of near-identical markup.
 */
export function UploadQueueItem({
  item,
  projectId,
  onRemove,
  onSettled,
}: {
  item: UploadItem;
  projectId: string;
  onRemove?: (id: string) => void;
  /** Called once the pipeline finishes, so the queue counter can move. */
  onSettled?: (id: string, status: 'indexed' | 'failed') => void;
}) {
  const { t } = useI18n();

  // Once the file is on the server, the interesting part is the ingestion
  // pipeline — parse, chunk, embed — which only the backend can report. The
  // hook self-disables until there is a revision to poll, and stops as soon as
  // the pipeline settles.
  const { data: ingestion } = useRevisionStatus(
    projectId,
    item.documentId ?? null,
    item.revisionId ?? null
  );
  const retry = useRetryRevision(projectId);

  /**
   * Once the pipeline reports back, it — not the queue row — is the truth about
   * this file: the row is set to `embedding` when the upload request returns and
   * never hears about what the worker did next.
   */
  const settledByPipeline = ingestion?.stage.step === 'done';
  const failedByPipeline = ingestion?.stage.failed ?? false;

  // Report the terminal state upward exactly once. The queue owns the counter,
  // but only this row polls, so the row is what knows the pipeline finished.
  useEffect(() => {
    if (item.status !== 'embedding') return;
    if (settledByPipeline) onSettled?.(item.id, 'indexed');
    else if (failedByPipeline) onSettled?.(item.id, 'failed');
  }, [failedByPipeline, item.id, item.status, onSettled, settledByPipeline]);

  const rejected = isRejected(item.status);
  // A server-side failure looks like a rejection to the user but has a different
  // cause — and a different hint, since retrying may well succeed.
  const failed = item.status === 'failed';

  return (
    <li
      className={cn(
        'rounded-lg border p-3',
        (rejected || failed || failedByPipeline) &&
          'border-status-failed/40 bg-status-failed-bg/50',
        item.status === 'embedding' &&
          !settledByPipeline &&
          !failedByPipeline &&
          'border-brand/30 bg-brand-subtle/40',
        !rejected &&
          !failed &&
          !failedByPipeline &&
          (item.status !== 'embedding' || settledByPipeline) &&
          'border-border'
      )}
    >
      <div className="flex items-center gap-3">
        <FileTypeIcon fileName={item.name} className="size-9" />

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-medium">{item.name}</span>

            {(item.status === 'indexed' || settledByPipeline) && (
              <span className="text-status-indexed flex shrink-0 items-center gap-1 text-xs font-medium">
                <CheckCircle2 className="size-3.5" aria-hidden />
                {t('upload.status.indexed')}
              </span>
            )}

            {item.status === 'embedding' && !settledByPipeline && !failedByPipeline && (
              <span className="text-brand flex shrink-0 items-center gap-1 text-xs font-medium">
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
                {t('upload.status.embedding')}
              </span>
            )}

            {item.status === 'uploading' && (
              <span className="text-muted-foreground shrink-0 text-xs">
                {t('upload.status.uploading', { percent: item.progress ?? 0 })}
              </span>
            )}

            {(rejected || failed) && (
              <span className="text-status-failed flex shrink-0 items-center gap-1 text-xs font-medium">
                <AlertCircle className="size-3.5" aria-hidden />
                {t(
                  failed
                    ? item.error === 'no-version'
                      ? 'upload.status.noVersion'
                      : 'upload.status.failed'
                    : item.status === 'rejected-size'
                      ? 'upload.status.tooLarge'
                      : 'upload.status.rejected'
                )}
              </span>
            )}

            {onRemove && (
              <IconButton
                icon={X}
                size="sm"
                label={t('upload.remove')}
                onClick={() => onRemove(item.id)}
              />
            )}
          </div>

          {item.status === 'indexed' && (
            <div className="text-muted-foreground mt-0.5 text-xs">
              {formatBytes(item.sizeBytes)}
              {item.chunkCount !== undefined &&
                ` · ${t('upload.chunks', { count: item.chunkCount })}`}
            </div>
          )}

          {item.status === 'embedding' &&
            (ingestion ? (
              <>
                <IngestionSteps stage={ingestion.stage} className="mt-2" />
                {/* A failed pipeline is a dead end without this — the file is on
                    the server but will never be searchable until it re-runs. */}
                {ingestion.stage.failed && item.documentId && item.revisionId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-1"
                    disabled={retry.isPending}
                    onClick={() =>
                      retry.mutate({
                        documentId: item.documentId!,
                        revisionId: item.revisionId!,
                      })
                    }
                  >
                    {t('ingestion.retry')}
                  </Button>
                )}
              </>
            ) : (
              <Progress className="mt-2" label={t('upload.status.embedding')} />
            ))}

          {item.status === 'uploading' && (
            <Progress
              className="mt-2"
              value={item.progress ?? 0}
              label={t('upload.status.uploading', { percent: item.progress ?? 0 })}
            />
          )}

          {(rejected || failed) && (
            <div className="text-status-failed/80 mt-0.5 text-xs break-words">
              {/* The server's own words when it gave any — "File vượt quá dung
                  lượng" tells the user what to do; the generic hint does not. */}
              {failed && item.errorMessage
                ? item.errorMessage
                : t(
                    failed
                      ? item.error === 'no-version'
                        ? 'upload.status.noVersionHint'
                        : 'upload.status.failedHint'
                      : 'upload.status.rejectedHint'
                  )}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
