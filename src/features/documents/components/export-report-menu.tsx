'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Download, FileCheck2, FileOutput } from 'lucide-react';

import { useI18n } from '@/core/i18n';
import {
  Button,
  messageOf,
  Modal,
  PendingActionDialogs,
  showErrorToast,
  usePendingAction,
} from '@/shared/ui';

import { documentsApi } from '../api/documents.api';

/**
 * "Xuất báo cáo" — a menu rather than a single button, because more report
 * types are planned and the entry point should not need redesigning when the
 * second one arrives.
 *
 * Only UAT Report is listed. Project Planning and Testcase are specified but
 * have no endpoint: `POST .../documents/uat-report` is the only export the
 * backend exposes, and it ignores a `type` field — sending `type: "planning"`
 * returns the identical UAT workbook, byte for byte (verified 07/09/2026).
 * Listing them would either lie about what the file is or show two permanently
 * dead rows, so they are absent until there is something to call.
 *
 * The export covers the whole project. There is no version selector because the
 * endpoint takes no scope that changes the output, and offering a choice that
 * does nothing is worse than not offering one.
 *
 * PDF is offered as a format but the endpoint only emits .xlsx, so choosing it
 * reports that rather than handing over a spreadsheet named .pdf.
 */
const REPORT_FORMATS = ['xlsx', 'pdf'] as const;
type ReportFormat = (typeof REPORT_FORMATS)[number];

export function ExportReportMenu({ projectId }: { projectId: string }) {
  const { t } = useI18n();

  const [menuOpen, setMenuOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [format, setFormat] = useState<ReportFormat>('xlsx');
  const pending = usePendingAction();
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

  /**
   * Fetch the report and hand it to the browser as a download.
   *
   * A blob URL rather than a link to the endpoint: it is a POST, so it cannot
   * be an `<a href>`. The URL is revoked immediately after the click — leaving
   * it alive pins the whole file in memory for the life of the tab.
   */
  const runExport = async () => {
    if (format !== 'xlsx') {
      setModalOpen(false);
      pending.request(t('reports.modalTitle'), t('reports.pdfComingSoon'));
      return;
    }

    setIsExporting(true);
    try {
      const blob = await documentsApi.exportUatReport(projectId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'UAT_Report.xlsx';
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

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              setModalOpen(true);
            }}
            className="hover:bg-accent flex w-full items-start gap-2.5 rounded-md px-2 py-2 text-left transition-colors"
          >
            <FileCheck2 className="text-brand mt-0.5 size-4" aria-hidden />
            <span className="min-w-0">
              <span className="block text-sm font-medium">{t('reports.uat')}</span>
              <span className="text-muted-foreground block text-xs">{t('reports.uatHint')}</span>
            </span>
          </button>
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
            <Button disabled={isExporting} onClick={() => void runExport()}>
              <Download aria-hidden />
              {isExporting ? t('reports.exporting') : t('reports.export')}
            </Button>
          </>
        }
      >
        <p className="text-muted-foreground">{t('reports.modalDescription')}</p>

        <div className="mt-4">
          <p className="text-muted-foreground mb-1.5 text-xs font-medium">{t('reports.format')}</p>
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
