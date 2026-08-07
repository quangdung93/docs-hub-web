'use client';

import { AlertCircle, CheckCircle2, Loader2, X } from 'lucide-react';

import { useI18n } from '@/core/i18n';
import { cn } from '@/shared/lib/utils';
import { FileTypeIcon, IconButton, Progress } from '@/shared/ui';

import { type UploadItem, formatBytes, isRejected } from '../services/upload-queue.service';

/**
 * One row of the processing queue. Each status renders a different trailing
 * element — a check, a spinner, a determinate bar, or an error hint — which is
 * why this is a component rather than four copies of near-identical markup.
 */
export function UploadQueueItem({
  item,
  onRemove,
}: {
  item: UploadItem;
  onRemove?: (id: string) => void;
}) {
  const { t } = useI18n();
  const rejected = isRejected(item.status);

  return (
    <li
      className={cn(
        'rounded-lg border p-3',
        rejected && 'border-status-failed/40 bg-status-failed-bg/50',
        item.status === 'embedding' && 'border-brand/30 bg-brand-subtle/40',
        !rejected && item.status !== 'embedding' && 'border-border'
      )}
    >
      <div className="flex items-center gap-3">
        <FileTypeIcon fileName={item.name} className="size-9" />

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-medium">{item.name}</span>

            {item.status === 'indexed' && (
              <span className="text-status-indexed flex shrink-0 items-center gap-1 text-xs font-medium">
                <CheckCircle2 className="size-3.5" aria-hidden />
                {t('upload.status.indexed')}
              </span>
            )}

            {item.status === 'embedding' && (
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

            {rejected && (
              <span className="text-status-failed flex shrink-0 items-center gap-1 text-xs font-medium">
                <AlertCircle className="size-3.5" aria-hidden />
                {t(
                  item.status === 'rejected-size'
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

          {item.status === 'embedding' && (
            <Progress className="mt-2" label={t('upload.status.embedding')} />
          )}

          {item.status === 'uploading' && (
            <Progress
              className="mt-2"
              value={item.progress ?? 0}
              label={t('upload.status.uploading', { percent: item.progress ?? 0 })}
            />
          )}

          {rejected && (
            <div className="text-status-failed/80 mt-0.5 text-xs">
              {t('upload.status.rejectedHint')}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
