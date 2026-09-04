'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  ClipboardList,
  Download,
  FileCheck2,
  FileOutput,
  GitBranch,
  GitCompareArrows,
  type LucideIcon,
} from 'lucide-react';

import { useI18n } from '@/core/i18n';
import {
  Button,
  Modal,
  PendingActionDialogs,
  Select,
  showErrorToast,
  usePendingAction,
} from '@/shared/ui';
import { messageOf } from '@/shared/ui';

import { documentsApi } from '../api/documents.api';
import { useProjectVersions } from '../hooks/use-documents';

/**
 * "Xuất báo cáo" — a menu, not a single button.
 *
 * There will be several report types, so the entry point is a list from the
 * start rather than one button that has to be redesigned when the second type
 * arrives. Only UAT Report is selectable; the other two are listed as coming so
 * the shape of the feature is visible without pretending they work.
 *
 * UAT Report is wired to `POST .../documents/uat-report`, which the backend
 * shipped on 04/09/2026 and which returns .xlsx bytes. The other two have no
 * endpoint yet and say so rather than producing an empty file.
 *
 * PDF is offered in the format picker but the endpoint only emits .xlsx, so
 * picking it is reported as not-yet-available instead of silently handing over
 * a spreadsheet named .pdf.
 */
const REPORT_FORMATS = ['xlsx', 'pdf'] as const;
type ReportFormat = (typeof REPORT_FORMATS)[number];

export function ExportReportMenu({ projectId }: { projectId: string }) {
  const { t } = useI18n();
  const { data: versions } = useProjectVersions(projectId);

  const [menuOpen, setMenuOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const pending = usePendingAction();
  const [versionId, setVersionId] = useState<string | undefined>();
  const [format, setFormat] = useState<ReportFormat>('xlsx');
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on an outside click or Escape. Scoped to the container so a click
  // inside the menu (picking a report type) does not dismiss it first.
  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const ordered = [...(versions ?? [])].sort((a, b) => b.sequence_no - a.sequence_no);
  const selectedVersion = versionId ?? ordered[0]?.id;

  /**
   * Fetch the report and hand it to the browser as a download.
   *
   * A blob URL rather than a link to the endpoint: it is a POST, so it cannot
   * be an `<a href>`. The URL is revoked immediately after the click — leaving
   * it alive pins the whole file in memory for the life of the tab.
   */
  const runExport = async () => {
    if (format !== 'xlsx') {
      // The endpoint emits .xlsx only. Saying so beats renaming a spreadsheet.
      setModalOpen(false);
      pending.request(t('reports.modalTitle'), t('reports.pdfComingSoon'));
      return;
    }

    setIsExporting(true);
    try {
      const blob = await documentsApi.exportUatReport(projectId, selectedVersion);
      const label = ordered.find((version) => version.id === selectedVersion)?.label ?? 'export';
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `UAT_Report_${label}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
      setModalOpen(false);
    } catch (error) {
      // The backend's own words — "Không có tài liệu nào trong phạm vi đã chọn"
      // tells the user what to change; a generic failure does not.
      showErrorToast(messageOf(error, t('reports.exportFailed')));
    } finally {
      setIsExporting(false);
    }
  };

  const openModal = () => {
    setMenuOpen(false);
    setVersionId(ordered[0]?.id);
    setModalOpen(true);
  };

  return (
    <div className="relative" ref={containerRef}>
      <Button variant="outline" onClick={() => setMenuOpen((open) => !open)}>
        <FileOutput aria-hidden />
        {t('reports.button')}
        <ChevronDown className="size-3.5" aria-hidden />
      </Button>

      {menuOpen && (
        <div
          role="menu"
          className="border-border bg-surface absolute top-11 right-0 z-30 w-72 rounded-lg border p-1.5 shadow-lg"
        >
          <p className="text-muted-foreground px-2 py-1 text-[11px] font-semibold tracking-wide uppercase">
            {t('reports.menuTitle')}
          </p>

          <ReportOption
            icon={FileCheck2}
            title={t('reports.uat')}
            hint={t('reports.uatHint')}
            onClick={openModal}
          />
          <ReportOption
            icon={GitCompareArrows}
            title={t('reports.rtm')}
            hint={t('reports.comingSoon')}
          />
          <ReportOption
            icon={ClipboardList}
            title={t('reports.tsr')}
            hint={t('reports.comingSoon')}
          />
        </div>
      )}

      <Modal
        open={modalOpen}
        title={t('reports.modalTitle')}
        icon={FileCheck2}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button disabled={!selectedVersion || isExporting} onClick={() => void runExport()}>
              <Download aria-hidden />
              {isExporting ? t('reports.exporting') : t('reports.export')}
            </Button>
          </>
        }
      >
        <p className="text-muted-foreground">{t('reports.modalDescription')}</p>

        <div className="mt-4 space-y-4">
          {ordered.length === 0 ? (
            <p className="text-status-queued text-sm">{t('reports.noVersion')}</p>
          ) : (
            <div>
              <Select
                value={selectedVersion ?? ''}
                onValueChange={setVersionId}
                options={ordered.map((version) => ({
                  value: version.id,
                  label: t('reports.scopeOption', { label: version.label }),
                }))}
                label={t('reports.scope')}
                icon={GitBranch}
                className="w-full"
              />
              <p className="text-muted-foreground mt-1 text-xs">{t('reports.scopeHint')}</p>
            </div>
          )}

          <div>
            <p className="text-muted-foreground mb-1.5 text-xs font-medium">
              {t('reports.format')}
            </p>
            <div className="flex gap-2">
              {REPORT_FORMATS.map((value) => (
                <Button
                  key={value}
                  type="button"
                  variant={format === value ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => setFormat(value)}
                >
                  {value === 'xlsx' ? 'Excel (.xlsx)' : 'PDF'}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      <PendingActionDialogs
        state={pending}
        confirmLabel={t('reports.export')}
        cancelLabel={t('common.cancel')}
        doneLabel={t('common.done')}
        noticeDescription={t('common.comingSoon')}
      />
    </div>
  );
}

/** A row in the report-type menu; without `onClick` it renders as coming soon. */
function ReportOption({
  icon: Icon,
  title,
  hint,
  onClick,
}: {
  icon: LucideIcon;
  title: string;
  hint: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={!onClick}
      onClick={onClick}
      className="hover:bg-accent flex w-full items-start gap-2.5 rounded-md px-2 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
    >
      <Icon
        className={onClick ? 'text-brand mt-0.5 size-4' : 'text-muted-foreground mt-0.5 size-4'}
        aria-hidden
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium">{title}</span>
        <span className="text-muted-foreground block text-xs">{hint}</span>
      </span>
    </button>
  );
}
