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
import { Button, Modal, PendingActionDialogs, Select, usePendingAction } from '@/shared/ui';

import { useProjectVersions } from '../hooks/use-documents';

/**
 * "Xuất báo cáo" — a menu, not a single button.
 *
 * There will be several report types, so the entry point is a list from the
 * start rather than one button that has to be redesigned when the second type
 * arrives. Only UAT Report is selectable; the other two are listed as coming so
 * the shape of the feature is visible without pretending they work.
 *
 * The export itself is not wired: docs-hub-api has no export endpoint at all
 * (`/exports`, `/reports`, `/uat-report` and `/templates` all 404, verified
 * 28/08/2026). Confirming the dialog says so plainly instead of producing an
 * empty file. The version and format the user picked are already collected, so
 * connecting a real endpoint is a one-function change.
 */
const REPORT_FORMATS = ['xlsx', 'pdf'] as const;
type ReportFormat = (typeof REPORT_FORMATS)[number];

export function ExportReportMenu({ projectId }: { projectId: string }) {
  const { t } = useI18n();
  const { data: versions } = useProjectVersions(projectId);

  const [menuOpen, setMenuOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
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
            <Button
              disabled={!selectedVersion}
              onClick={() => {
                setModalOpen(false);
                // The picked version and format are already known here; only the
                // request is missing, so this is the one line that changes when
                // an export endpoint lands.
                pending.request(
                  t('reports.modalTitle'),
                  t('reports.exportConfirm', {
                    label: ordered.find((v) => v.id === selectedVersion)?.label ?? '',
                    format: format === 'xlsx' ? 'Excel (.xlsx)' : 'PDF',
                  })
                );
              }}
            >
              <Download aria-hidden />
              {t('reports.export')}
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
