'use client';

import { Download, Eye, FileText, Sparkles, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import { useI18n } from '@/core/i18n';
import { formatRelativeTime } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import {
  Badge,
  Button,
  ConfirmDialog,
  DataTable,
  ErrorState,
  FileTypeIcon,
  IconButton,
  Pagination,
  Skeleton,
  TableCell,
  TableEmptyRow,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '@/shared/ui';

import { documentsApi } from '../api/documents.api';
import { useDeleteDocument, useDocuments, useVersionLabels } from '../hooks/use-documents';
import {
  completenessDisplay,
  completenessPercent,
  completenessTone,
  type UrdSummary,
} from '../services/completeness.service';
import { formatBytes, matchesFormat } from '../services/upload-queue.service';
import type { DocumentFormat, DocumentStatus } from '../schemas/document.schema';

import { DocumentDetailModal } from './document-detail-modal';
import { DocumentPreviewModal } from './document-preview-modal';
import { DocumentStatusBadge } from './document-status-badge';
import { useUrdSummary } from '../hooks/use-urd';
import { EdgeCaseModal } from './edge-case-modal';

const PAGE_SIZE = 6;
const COLUMN_COUNT = 7;

/**
 * Document list with search, status filter, row selection and pagination. Filter
 * and page state is local because this table lives inside a single screen; move
 * it to `searchParams` the moment these views need to be shareable links.
 */
export function DocumentTable({
  projectId,
  search,
  formatFilter = 'all',
  statusFilter,
  versionFilter = 'all',
}: {
  projectId: string;
  search: string;
  formatFilter?: DocumentFormat | 'all';
  statusFilter: DocumentStatus | 'all';
  /** A project version id, or 'all'. */
  versionFilter?: string;
}) {
  const { t, locale } = useI18n();
  const { data: documents, isPending, isError, error, refetch } = useDocuments(projectId);
  const { labelOf } = useVersionLabels(projectId);
  const deleteDocument = useDeleteDocument(projectId);

  const [page, setPage] = useState(1);
  /** Which row's detail modal is open, and which of its tabs. */
  const [opened, setOpened] = useState<{ id: string; tab: 'info' | 'history' } | null>(null);
  /** Which row's file is being previewed. */
  const [previewId, setPreviewId] = useState<string | null>(null);
  /** The row awaiting delete confirmation. Deleting is a soft delete on the
   *  backend, but it still pulls the document out of every listing and out of
   *  retrieval, so it goes through the same gate as the other destructive
   *  actions in the app rather than firing straight off the icon. */
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);
  /** Tài liệu đang mở modal phân tích edge case. */
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  /**
   * Còn tài liệu nào đang chạy pipeline ingest không. Bật polling cho cả hai
   * truy vấn vẽ nên một hàng, để trạng thái và ô "Hoàn thiện" không lệch nhịp.
   */
  const hasPending = (documents ?? []).some(
    (item) => item.status === 'processing' || item.status === 'queued'
  );
  /** documentId → độ hoàn thiện, lấy một lần cho cả bảng từ `urd-summary`. */
  const { data: urdSummary } = useUrdSummary(projectId, hasPending);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (documents ?? []).filter((document) => {
      const matchesQuery = !query || document.name.toLowerCase().includes(query);
      const matchesStatus = statusFilter === 'all' || document.status === statusFilter;
      // Filtered here rather than server-side: the backend accepts
      // `?project_version_id=` but ignores it — a bogus id still returns every
      // document (verified 28/08/2026). Move this to the query the day it works.
      const matchesVersion = versionFilter === 'all' || document.projectVersionId === versionFilter;
      return (
        matchesQuery &&
        matchesStatus &&
        matchesVersion &&
        matchesFormat(document.fileName ?? document.name, formatFilter, document.format)
      );
    });
  }, [documents, search, formatFilter, statusFilter, versionFilter]);

  // Narrowing the filters can leave `page` past the end of the new result set.
  // Deriving the key from the filters and resetting during render (rather than in
  // an effect) keeps the pager from flashing an empty page.
  const filterKey = `${search}|${formatFilter}|${statusFilter}|${versionFilter}`;
  const [lastFilterKey, setLastFilterKey] = useState(filterKey);
  if (filterKey !== lastFilterKey) {
    setLastFilterKey(filterKey);
    setPage(1);
  }

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <>
      <DataTable className="mt-4">
        <TableHead>
          <tr>
            <TableHeaderCell>{t('documents.column.name')}</TableHeaderCell>
            <TableHeaderCell>{t('documents.column.size')}</TableHeaderCell>
            <TableHeaderCell>{t('documents.column.version')}</TableHeaderCell>
            <TableHeaderCell>{t('documents.column.updatedAt')}</TableHeaderCell>
            <TableHeaderCell>{t('documents.column.status')}</TableHeaderCell>
            <TableHeaderCell>{t('completeness.column.state')}</TableHeaderCell>
            <TableHeaderCell className="text-right">
              {t('documents.column.actions')}
            </TableHeaderCell>
          </tr>
        </TableHead>

        <tbody>
          {isPending &&
            Array.from({ length: 4 }, (_, index) => (
              <TableRow key={index}>
                <TableCell colSpan={COLUMN_COUNT}>
                  <Skeleton className="h-8 w-full" />
                </TableCell>
              </TableRow>
            ))}

          {/* Checked before the empty row: a failed query has no rows either,
              and reporting that as "no documents" hides the fault and gives the
              user no reason to retry. */}
          {isError && (
            <TableEmptyRow colSpan={COLUMN_COUNT}>
              <ErrorState
                error={error}
                title={t('documents.loadError')}
                fallbackMessage={t('error.loadFailed')}
                retryLabel={t('common.retry')}
                onRetry={() => void refetch()}
                className="py-6"
              />
            </TableEmptyRow>
          )}

          {!isPending && !isError && visible.length === 0 && (
            <TableEmptyRow colSpan={COLUMN_COUNT}>
              {search || statusFilter !== 'all' || versionFilter !== 'all'
                ? t('documents.emptySearch')
                : t('documents.empty')}
            </TableEmptyRow>
          )}

          {!isPending &&
            !isError &&
            visible.map((document) => (
              <TableRow key={document.id}>
                <TableCell>
                  <button
                    type="button"
                    onClick={() => setOpened({ id: document.id, tab: 'info' })}
                    className="focus-visible:ring-ring/40 flex items-center gap-2.5 rounded-md text-left focus-visible:ring-2 focus-visible:outline-none"
                    aria-label={t('documentDetail.open')}
                  >
                    <FileTypeIcon fileName={document.fileName ?? document.name} />
                    <div className="leading-tight">
                      <div className="font-medium hover:underline">{document.name}</div>
                      <div className="text-muted-foreground text-xs">{document.format}</div>
                    </div>
                  </button>
                </TableCell>

                <TableCell className="text-muted-foreground">
                  {formatBytes(document.sizeBytes)}
                </TableCell>

                {/* Two different things share the word "version", so both are
                    shown: the document's own revision number (v1 → v2 on
                    re-upload) and the project version it was uploaded into. */}
                <TableCell className="whitespace-nowrap">
                  <span className="inline-flex items-center gap-1.5">
                    {document.revisionNo !== null && (
                      <button
                        type="button"
                        onClick={() => setOpened({ id: document.id, tab: 'history' })}
                        className="focus-visible:ring-ring/40 rounded-full focus-visible:ring-2 focus-visible:outline-none"
                      >
                        <Badge variant="neutral" className="hover:bg-accent cursor-pointer">
                          {t('history.revision', { no: document.revisionNo })}
                        </Badge>
                      </button>
                    )}
                    <span className="text-muted-foreground text-xs">
                      {labelOf(document.projectVersionId) ?? t('common.emptyValue')}
                    </span>
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground whitespace-nowrap">
                  {formatRelativeTime(document.updatedAt, locale)}
                </TableCell>
                <TableCell>
                  <DocumentStatusBadge status={document.status} />
                </TableCell>

                <TableCell>
                  <CompletenessCell
                    status={document.status}
                    summary={urdSummary?.get(document.id) ?? null}
                    onOpen={() => setAnalyzingId(document.id)}
                  />
                </TableCell>

                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    {/* A plain link, not a fetch: the response carries
                        `Content-Disposition: attachment` with the real filename,
                        so the browser saves it correctly on its own. Disabled
                        until the row knows its revision — every per-file action
                        addresses the revision, not the document. */}
                    {/* Preview before download: reading the file is the common
                        intent, saving it the exception. */}
                    <IconButton
                      icon={Eye}
                      size="sm"
                      label={t('preview.open')}
                      disabled={!document.revisionId}
                      onClick={() => setPreviewId(document.id)}
                    />
                    {document.revisionId ? (
                      <a
                        href={documentsApi.downloadUrl(projectId, document.id, document.revisionId)}
                        download
                        aria-label={t('documents.action.download')}
                        className="text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring/40 inline-flex size-8 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none"
                      >
                        <Download className="size-4" aria-hidden />
                      </a>
                    ) : (
                      <IconButton
                        icon={Download}
                        size="sm"
                        label={t('documents.action.download')}
                        disabled
                      />
                    )}
                    <IconButton
                      icon={Trash2}
                      size="sm"
                      label={t('documents.action.delete')}
                      className="hover:text-status-failed"
                      disabled={deleteDocument.isPending}
                      onClick={() => setPendingDelete({ id: document.id, name: document.name })}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
        </tbody>
      </DataTable>

      <DocumentPreviewModal
        projectId={projectId}
        document={(documents ?? []).find((item) => item.id === previewId) ?? null}
        onClose={() => setPreviewId(null)}
      />

      <DocumentDetailModal
        projectId={projectId}
        document={(documents ?? []).find((item) => item.id === opened?.id) ?? null}
        initialTab={opened?.tab ?? 'info'}
        onClose={() => setOpened(null)}
      />

      <EdgeCaseModal
        projectId={projectId}
        document={(documents ?? []).find((item) => item.id === analyzingId) ?? null}
        analysisId={analyzingId ? (urdSummary?.get(analyzingId)?.analysisId ?? null) : null}
        onClose={() => setAnalyzingId(null)}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        title={t('documents.delete.title')}
        description={t('documents.delete.description', { name: pendingDelete?.name ?? '' })}
        confirmLabel={t('documents.action.delete')}
        cancelLabel={t('common.cancel')}
        pending={deleteDocument.isPending}
        onConfirm={() => {
          if (!pendingDelete) return;
          deleteDocument.mutate(pendingDelete.id, {
            onSettled: () => setPendingDelete(null),
          });
        }}
        onCancel={() => setPendingDelete(null)}
      />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground inline-flex items-center gap-1.5">
          <FileText className="size-3.5" aria-hidden />
          {t('documents.count', { count: filtered.length })}
        </span>
        <Pagination
          page={safePage}
          pageCount={pageCount}
          onPageChange={setPage}
          previousLabel={t('common.previous')}
          nextLabel={t('common.next')}
        />
      </div>
    </>
  );
}

/**
 * Ô "Hoàn thiện" của một dòng tài liệu.
 *
 * Số liệu lấy từ `documents/urd-summary` — một lời gọi cho cả bảng, nên thêm cột
 * này không làm mỗi dòng phát sinh một request.
 *
 * Dòng chưa có trong tóm tắt nghĩa là chưa từng phân tích, và vẫn bấm được:
 * điều kiện để phân tích (đã xác nhận `doc_type=urd`, revision có nguồn
 * canonical) do backend giữ, client không đoán lại bằng tên file. Đoán sai theo
 * hướng chặn thì người dùng mất hẳn lối vào tính năng.
 */
function CompletenessCell({
  status,
  summary,
  onOpen,
}: {
  status: DocumentStatus;
  summary: UrdSummary | null;
  onOpen: () => void;
}) {
  const { t } = useI18n();

  // Tài liệu chưa lập chỉ mục xong thì chưa có nguồn canonical, và `urd/analyze`
  // chắc chắn trả về lỗi. Mời người dùng bấm vào một việc không thể thành công
  // là mời họ đi vào ngõ cụt, nên để trống ô cho tới khi tài liệu sẵn sàng.
  //
  // Đã phân tích rồi thì vẫn hiện kết quả kể cả khi bản revision mới đang xử lý:
  // mất số liệu cũ giữa chừng khó hiểu hơn là giữ lại.
  const display = completenessDisplay(status, summary);

  if (display === 'empty') {
    return <span className="text-muted-foreground text-xs">{t('common.emptyValue')}</span>;
  }

  // Chưa từng phân tích: vẫn cho bấm. Tài liệu nào phân tích được là do backend
  // quyết (`doc_type`, nguồn canonical), nên client không đoán trước bằng tên
  // file nữa — đoán sai theo hướng chặn thì người dùng không có cách nào mở ra.
  if (!summary) {
    return (
      <Button variant="outline" size="sm" onClick={onOpen} className="whitespace-nowrap">
        <Sparkles aria-hidden />
        {t('completeness.notAnalyzed')}
      </Button>
    );
  }

  const percent = completenessPercent(summary.totalCases, summary.resolvedCases);
  const tone = completenessTone(percent);

  return (
    <button
      type="button"
      onClick={onOpen}
      title={t('completeness.continue')}
      className="focus-visible:ring-ring/40 w-36 rounded text-left focus-visible:ring-2 focus-visible:outline-none"
    >
      <div className="text-muted-foreground flex items-center justify-between text-xs">
        <span className="font-semibold">{percent}%</span>
        <span>
          {t('completeness.caseCount', {
            done: summary.resolvedCases,
            total: summary.totalCases,
          })}
        </span>
      </div>
      {/* Thanh vẽ tay thay vì dùng `Progress`: ở đây cần đổi màu theo ngưỡng,
          mà `Progress` chỉ có một màu brand. */}
      <div className="bg-muted mt-1 h-1.5 w-full overflow-hidden rounded-full">
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-500',
            tone === 'indexed' && 'bg-status-indexed',
            tone === 'queued' && 'bg-status-queued',
            tone === 'failed' && 'bg-status-failed'
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
    </button>
  );
}
