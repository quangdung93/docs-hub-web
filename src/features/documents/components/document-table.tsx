'use client';

import { Download, FileText, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import { useI18n } from '@/core/i18n';
import { formatRelativeTime } from '@/shared/lib/format';
import {
  Badge,
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
import { formatBytes, matchesFormat } from '../services/upload-queue.service';
import type { DocumentFormat, DocumentStatus } from '../schemas/document.schema';

import { DocumentDetailModal } from './document-detail-modal';
import { DocumentStatusBadge } from './document-status-badge';

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
            <TableHeaderCell>{t('documents.column.chunks')}</TableHeaderCell>
            <TableHeaderCell>{t('documents.column.version')}</TableHeaderCell>
            <TableHeaderCell>{t('documents.column.updatedAt')}</TableHeaderCell>
            <TableHeaderCell>{t('documents.column.status')}</TableHeaderCell>
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
                <TableCell className="text-muted-foreground">
                  {document.chunkCount ?? t('common.emptyValue')}
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
                  <div className="flex items-center justify-end gap-1">
                    {/* A plain link, not a fetch: the response carries
                        `Content-Disposition: attachment` with the real filename,
                        so the browser saves it correctly on its own. Disabled
                        until the row knows its revision — every per-file action
                        addresses the revision, not the document. */}
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
                      onClick={() => deleteDocument.mutate(document.id)}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
        </tbody>
      </DataTable>

      <DocumentDetailModal
        projectId={projectId}
        document={(documents ?? []).find((item) => item.id === opened?.id) ?? null}
        initialTab={opened?.tab ?? 'info'}
        onClose={() => setOpened(null)}
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
