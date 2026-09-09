'use client';

import { Download, History } from 'lucide-react';

import { useI18n } from '@/core/i18n';
import { formatDate } from '@/shared/lib/format';
import { Badge, Button, EmptyState, ErrorState, Modal, Skeleton } from '@/shared/ui';

import { useReportHistory } from '../hooks/use-documents';
import { reportDownloadHref } from '../services/report.service';

/**
 * Past report exports, newest first.
 *
 * Only queried while the dialog is open: every row carries a presigned URL the
 * backend signs at read time, so fetching this list in the background would
 * mint links that expire before anyone clicks them.
 */
export function ReportHistoryModal({
  projectId,
  open,
  onClose,
}: {
  projectId: string;
  open: boolean;
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const { data, isPending, isError, error, refetch } = useReportHistory(projectId, open);

  return (
    <Modal
      open={open}
      title={t('reports.historyTitle')}
      icon={History}
      onClose={onClose}
      className="w-[min(40rem,calc(100vw-2rem))]"
      footer={
        <Button variant="outline" onClick={onClose}>
          {t('common.done')}
        </Button>
      }
    >
      <p className="text-muted-foreground text-xs">{t('reports.historyExpired')}</p>

      <div className="mt-3 max-h-[55vh] overflow-auto">
        {isPending ? (
          <div className="space-y-2">
            {[0, 1, 2].map((row) => (
              <Skeleton key={row} className="h-14 w-full" />
            ))}
          </div>
        ) : isError ? (
          <ErrorState
            error={error}
            title={t('reports.generateFailed')}
            fallbackMessage={t('error.loadFailed')}
            retryLabel={t('common.retry')}
            onRetry={() => void refetch()}
            className="py-6"
          />
        ) : data.length === 0 ? (
          <EmptyState icon={History} title={t('reports.historyEmpty')} />
        ) : (
          <ul className="divide-border divide-y">
            {data.map(({ report, download_url }) => (
              <li key={report.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {t(reportTypeKey(report.report_type))}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {formatDate(report.created_at, locale)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant="neutral">{report.format.toUpperCase()}</Badge>
                  {/* Routed through the same-origin relay, not straight at the
                      presigned URL — see `report.service.ts` for why a direct
                      link neither passes the CSP nor keeps the filename. */}
                  <Button asChild size="sm" variant="outline">
                    <a
                      href={reportDownloadHref(
                        download_url,
                        report.report_type,
                        report.format,
                        report.created_at
                      )}
                      download
                    >
                      <Download aria-hidden />
                      {t('reports.download')}
                    </a>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}

/**
 * Label a report type. Falls back to the UAT label for an unknown value rather
 * than rendering a raw key — the backend could add a fourth type before the UI
 * knows about it.
 */
function reportTypeKey(type: string) {
  if (type === 'planning') return 'reports.planning' as const;
  if (type === 'testcase') return 'reports.testcase' as const;
  return 'reports.uat' as const;
}
