'use client';

import { useMemo, useState } from 'react';

import { useI18n } from '@/core/i18n';
import { formatRelativeTime } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
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
 * `/audit-logs` and `/history` all 404 (verified 11/09/2026).
 *
 * Each entry is labelled Thêm mới or Cập nhật, derived from the revision number:
 * revision 1 created the document, anything above it replaced the file.
 *
 * Deletions **are** shown, since the backend gained `?include_deleted=true` on
 * the list endpoint (11/09/2026). Nhưng một tài liệu đã xóa không kèm revision
 * nào trong response, nên mục "Đã xóa" được dựng từ `deleted_at` thay vì từ
 * `history` — xem `entries` bên dưới. `GET /documents/{id}` vẫn trả 404 cho bản
 * ghi đã xóa, kể cả khi thêm `include_deleted`, nên transport bỏ qua bước gọi
 * detail cho những dòng đó.
 */
export function DocumentHistoryList({ projectId }: { projectId: string }) {
  const { t, locale } = useI18n();
  const {
    data: documents,
    isPending,
    isError,
    error,
    refetch,
  } = useDocuments(projectId, { includeDeleted: true });
  const { labelOf } = useVersionLabels(projectId);
  const [openedId, setOpenedId] = useState<string | null>(null);

  const entries = useMemo(
    () =>
      (documents ?? [])
        .flatMap((document) => {
          const uploads = document.history.map((revision) => ({
            ...revision,
            documentId: document.id,
            documentName: document.name,
            // Revision 1 is the upload that created the document; later ones
            // replaced its file.
            isFirst: revision.revisionNo === 1,
            // The newest revision of a document is the one the table shows.
            isCurrent: revision.id === document.revisionId,
            isDeletion: false,
          }));

          if (!document.isDeleted || !document.deletedAt) return uploads;

          // Một tài liệu đã xóa không kèm revision nào trong response list, nên
          // `uploads` rỗng và nó sẽ biến mất khỏi dòng thời gian nếu chỉ dựa vào
          // đó. Mục xóa được dựng thẳng từ `deletedAt`.
          return [
            ...uploads,
            {
              id: `${document.id}:deleted`,
              revisionNo: document.revisionNo ?? 1,
              fileName: document.fileName ?? document.name,
              sizeBytes: document.sizeBytes,
              status: document.status,
              projectVersionId: document.projectVersionId,
              uploadedBy: null,
              // Dùng chung trường thời gian để sắp xếp cả dòng thời gian.
              uploadedAt: document.deletedAt,
              documentId: document.id,
              documentName: document.name,
              isFirst: false,
              isCurrent: false,
              isDeletion: true,
            },
          ];
        })
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
                  {/* Ba loại mục: revision 1 tạo tài liệu, revision sau thay thế
                      file, và mục xóa dựng từ `deletedAt`. */}
                  <Badge
                    variant={entry.isDeletion ? 'failed' : entry.isFirst ? 'indexed' : 'brand'}
                    className="shrink-0"
                  >
                    {entry.isDeletion
                      ? t('history.action.deleted')
                      : entry.isFirst
                        ? t('history.action.added')
                        : t('history.action.updated')}
                  </Badge>
                  <span
                    className={cn(
                      'truncate text-sm font-medium',
                      entry.isDeletion && 'text-muted-foreground line-through'
                    )}
                  >
                    {entry.documentName}
                  </span>
                </div>
                {/* Cùng lý do: số revision của mục xóa cũng không đọc được từ
                    response, nên chỉ hiện cho các mục tải lên. */}
                {!entry.isDeletion && (
                  <div className="text-muted-foreground truncate text-xs">
                    <span className="text-muted-foreground font-normal">
                      {t('history.revision', { no: entry.revisionNo })}
                    </span>
                  </div>
                )}
                <div className="text-muted-foreground mt-0.5 text-xs">
                  {formatRelativeTime(entry.uploadedAt, locale)}
                  {/* Response list không kèm revision cho tài liệu đã xóa, nên
                      `sizeBytes` là 0 do mapper gán mặc định chứ không phải số
                      đo được. Hiện "0 B" sẽ là bịa ra một con số. */}
                  {!entry.isDeletion && ` · ${formatBytes(entry.sizeBytes)}`}
                  {versionLabel && ` · ${versionLabel}`}
                </div>
              </div>
            </div>

            {/* Trạng thái ingest của một tài liệu đã xóa không còn nghĩa gì, nên
                mục xóa không mang badge trạng thái. */}
            {!entry.isDeletion && (
              <div className="flex shrink-0 items-center gap-2">
                <DocumentStatusBadge status={entry.status} />
              </div>
            )}
          </button>
        );
      })}

      <DocumentDetailModal
        projectId={projectId}
        document={(documents ?? []).find((item) => item.id === openedId) ?? null}
        initialTab="history"
        onClose={() => setOpenedId(null)}
      />
    </div>
  );
}
