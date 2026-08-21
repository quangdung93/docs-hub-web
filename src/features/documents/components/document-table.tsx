'use client';

import { Download, FileText, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import { useI18n } from '@/core/i18n';
import { formatRelativeTime } from '@/shared/lib/format';
import {
  DataTable,
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

import { useDeleteDocument, useDocuments } from '../hooks/use-documents';
import { formatBytes, matchesFormat } from '../services/upload-queue.service';
import type { DocumentFormat, DocumentStatus } from '../schemas/document.schema';

import { DocumentStatusBadge } from './document-status-badge';

const PAGE_SIZE = 6;
const COLUMN_COUNT = 6;

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
}: {
  projectId: string;
  search: string;
  formatFilter?: DocumentFormat | 'all';
  statusFilter: DocumentStatus | 'all';
}) {
  const { t, locale } = useI18n();
  const { data: documents, isPending } = useDocuments(projectId);
  const deleteDocument = useDeleteDocument(projectId);

  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (documents ?? []).filter((document) => {
      const matchesQuery = !query || document.name.toLowerCase().includes(query);
      const matchesStatus = statusFilter === 'all' || document.status === statusFilter;
      return (
        matchesQuery &&
        matchesStatus &&
        matchesFormat(document.fileName ?? document.name, formatFilter, document.format)
      );
    });
  }, [documents, search, formatFilter, statusFilter]);

  // Narrowing the filters can leave `page` past the end of the new result set.
  // Deriving the key from the filters and resetting during render (rather than in
  // an effect) keeps the pager from flashing an empty page.
  const filterKey = `${search}|${formatFilter}|${statusFilter}`;
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

          {!isPending && visible.length === 0 && (
            <TableEmptyRow colSpan={COLUMN_COUNT}>
              {search || statusFilter !== 'all' ? t('documents.emptySearch') : t('documents.empty')}
            </TableEmptyRow>
          )}

          {!isPending &&
            visible.map((document) => (
              <TableRow key={document.id}>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <FileTypeIcon fileName={document.fileName ?? document.name} />
                    <div className="leading-tight">
                      <div className="font-medium">{document.name}</div>
                      <div className="text-muted-foreground text-xs">{document.format}</div>
                    </div>
                  </div>
                </TableCell>

                <TableCell className="text-muted-foreground">
                  {formatBytes(document.sizeBytes)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {document.chunkCount ?? t('common.emptyValue')}
                </TableCell>
                <TableCell className="text-muted-foreground whitespace-nowrap">
                  {formatRelativeTime(document.updatedAt, locale)}
                </TableCell>
                <TableCell>
                  <DocumentStatusBadge status={document.status} />
                </TableCell>

                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <IconButton icon={Download} size="sm" label={t('documents.action.download')} />
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
