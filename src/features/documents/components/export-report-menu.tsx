'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  ClipboardList,
  Download,
  FileCheck2,
  FileOutput,
  History,
  Sparkles,
} from 'lucide-react';

import { useI18n } from '@/core/i18n';
import { Button, Field, Input, messageOf, Modal, Select, showErrorToast } from '@/shared/ui';

import { documentsApi, type ReportFormat, type ReportType } from '../api/documents.api';
import { useGenerateReport, useProjectVersions } from '../hooks/use-documents';
import { reportDownloadHref } from '../services/report.service';

import { ReportHistoryModal } from './report-history-modal';

/**
 * "Xuất báo cáo" — the entry point for every report the project can produce.
 *
 * There are two different exports behind this menu, and the split is real
 * rather than cosmetic:
 *
 *  - **UAT · template ISC** → `POST .../documents/uat-report`. Fills the ISC
 *    workbook mechanically, streams the bytes back, and accepts the PO / PM /
 *    scope / date header fields. No AI involved, so it is fast and predictable.
 *  - **UAT · AI, Planning, Testcase** → `POST .../projects/{id}/reports`. Asks
 *    RAGFlow to read the documents and write the report, then answers with a
 *    presigned download URL. Takes tens of seconds and can fail on content.
 *
 * Both UAT rows are offered because neither is a superset: the template one is
 * the only way to stamp acceptance details onto the sheet (RAGFlow accepts
 * those fields and silently drops them), and the AI one is the only one that
 * writes test cases from the documents themselves.
 */
const REPORT_FORMATS = ['xlsx', 'pdf'] as const;

/** Sentinel for "no version filter", since a Select needs a real string value. */
const ALL_VERSIONS = 'all';

/** Which export the dialog is currently set up for. */
type ExportKind = 'uat-template' | ReportType;

export function ExportReportMenu({ projectId }: { projectId: string }) {
  const { t } = useI18n();

  const [menuOpen, setMenuOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [kind, setKind] = useState<ExportKind | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [format, setFormat] = useState<ReportFormat>('xlsx');
  const [versionId, setVersionId] = useState<string>(ALL_VERSIONS);
  const [details, setDetails] = useState({
    po: '',
    pm: '',
    scopeTest: '',
    accountTest: '',
    startDate: '',
    dueDate: '',
  });
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: versions } = useProjectVersions(projectId);
  const generateReport = useGenerateReport(projectId);

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

  const versionOptions = [
    { value: ALL_VERSIONS, label: t('reports.scopeAll') },
    ...(versions ?? []).map((version) => ({ value: version.id, label: version.label })),
  ];

  const setDetail = (key: keyof typeof details) => (value: string) =>
    setDetails((current) => ({ ...current, [key]: value }));

  const openDialog = (next: ExportKind) => {
    setKind(next);
    setMenuOpen(false);
  };

  /** Hand a URL to the browser as a download. */
  const saveAs = (href: string, fileName?: string) => {
    const link = document.createElement('a');
    link.href = href;
    if (fileName) link.download = fileName;
    link.click();
  };

  /**
   * Template export: the response *is* the file, so it arrives as a blob and is
   * handed over through an object URL. Revoked immediately — leaving it alive
   * pins the whole file in memory for the life of the tab.
   */
  const runTemplateExport = async () => {
    setIsExporting(true);
    try {
      const { blob, fileName } = await documentsApi.exportUatReport(projectId, {
        format,
        projectVersionId: versionId === ALL_VERSIONS ? undefined : versionId,
        ...details,
      });
      const url = URL.createObjectURL(blob);
      saveAs(url, fileName);
      URL.revokeObjectURL(url);
      setKind(null);
    } catch (error) {
      // The backend's own words — "Không có tài liệu nào trong phạm vi đã chọn"
      // tells the user what to change; a generic failure does not.
      showErrorToast(messageOf(error, t('reports.exportFailed')));
    } finally {
      setIsExporting(false);
    }
  };

  /**
   * RAGFlow export: the response is JSON with a presigned URL pointing at
   * storage, not at the API.
   *
   * The download goes through `/api/storage-get` rather than straight at that
   * URL. Two reasons, both load-bearing: `connect-src 'self'` blocks the page
   * from fetching storage at all, and a cross-origin href ignores `download`,
   * so the file would save under its UUID object key.
   */
  const runGenerate = async (reportType: ReportType) => {
    try {
      const result = await generateReport.mutateAsync({
        reportType,
        format,
        projectVersionId: versionId === ALL_VERSIONS ? undefined : versionId,
      });

      saveAs(
        reportDownloadHref(
          result.download_url,
          result.report.report_type,
          result.report.format,
          result.report.created_at
        )
      );
      setKind(null);
    } catch (error) {
      // Content failures land here too — "Không tìm thấy User Story/Acceptance
      // Criteria nào trong tài liệu dự án" is the backend telling the user their
      // documents lack what this report needs, which is worth reading verbatim.
      showErrorToast(messageOf(error, t('reports.generateFailed')));
    }
  };

  const isTemplate = kind === 'uat-template';
  const pending = isTemplate ? isExporting : generateReport.isPending;

  const dialogTitle = isTemplate
    ? t('reports.uatTemplate')
    : kind === 'planning'
      ? t('reports.planning')
      : kind === 'testcase'
        ? t('reports.testcase')
        : t('reports.uatAi');

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
          className="border-border bg-surface absolute top-11 right-0 z-30 w-80 rounded-lg border p-1.5 shadow-lg"
        >
          <p className="text-muted-foreground px-2 py-1 text-[11px] font-semibold tracking-wide uppercase">
            {t('reports.menuTitle')}
          </p>

          <MenuItem
            icon={FileCheck2}
            title={t('reports.uatTemplate')}
            hint={t('reports.uatTemplateHint')}
            onClick={() => openDialog('uat-template')}
          />

          <p className="text-muted-foreground mt-1 px-2 py-1 text-[11px] font-semibold tracking-wide uppercase">
            {t('reports.aiGroup')}
          </p>

          <MenuItem
            icon={Sparkles}
            title={t('reports.uatAi')}
            hint={t('reports.uatAiHint')}
            onClick={() => openDialog('uat')}
          />
          <MenuItem
            icon={ClipboardList}
            title={t('reports.planning')}
            hint={t('reports.planningHint')}
            onClick={() => openDialog('planning')}
          />
          <MenuItem
            icon={ClipboardList}
            title={t('reports.testcase')}
            hint={t('reports.testcaseHint')}
            onClick={() => openDialog('testcase')}
          />

          <div className="border-border mt-1 border-t pt-1">
            <MenuItem
              icon={History}
              title={t('reports.historyOpen')}
              onClick={() => {
                setMenuOpen(false);
                setHistoryOpen(true);
              }}
            />
          </div>
        </div>
      )}

      <Modal
        open={kind !== null}
        title={dialogTitle}
        icon={isTemplate ? FileCheck2 : Sparkles}
        onClose={() => setKind(null)}
        className="w-[min(40rem,calc(100vw-2rem))]"
        footer={
          <>
            <Button variant="outline" onClick={() => setKind(null)} disabled={pending}>
              {t('common.cancel')}
            </Button>
            <Button
              disabled={pending}
              onClick={() => {
                if (isTemplate) void runTemplateExport();
                else if (kind) void runGenerate(kind);
              }}
            >
              <Download aria-hidden />
              {pending
                ? isTemplate
                  ? t('reports.exporting')
                  : t('reports.generating')
                : t('reports.export')}
            </Button>
          </>
        }
      >
        <p className="text-muted-foreground">
          {isTemplate ? t('reports.modalDescription') : t('reports.generatingHint')}
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label={t('reports.scope')}>
            <Select
              value={versionId}
              onValueChange={setVersionId}
              options={versionOptions}
              label={t('reports.scope')}
              className="w-full"
            />
          </Field>

          <div>
            <p className="text-muted-foreground mb-1.5 text-sm font-medium">
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

        {/* Only the template export writes these into the sheet. RAGFlow accepts
            them on the wire and drops them, so offering them there would be a
            lie about what ends up in the file. */}
        {isTemplate && (
          <div className="border-border mt-5 border-t pt-4">
            <p className="text-sm font-medium">{t('reports.details')}</p>
            <p className="text-muted-foreground mt-1 text-xs">{t('reports.detailsHint')}</p>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label={t('reports.po')} htmlFor="report-po">
                <Input
                  id="report-po"
                  value={details.po}
                  onChange={(event) => setDetail('po')(event.target.value)}
                />
              </Field>
              <Field label={t('reports.pm')} htmlFor="report-pm">
                <Input
                  id="report-pm"
                  value={details.pm}
                  onChange={(event) => setDetail('pm')(event.target.value)}
                />
              </Field>
              <Field label={t('reports.scopeTest')} htmlFor="report-scope-test">
                <Input
                  id="report-scope-test"
                  value={details.scopeTest}
                  onChange={(event) => setDetail('scopeTest')(event.target.value)}
                />
              </Field>
              <Field label={t('reports.accountTest')} htmlFor="report-account-test">
                <Input
                  id="report-account-test"
                  value={details.accountTest}
                  onChange={(event) => setDetail('accountTest')(event.target.value)}
                />
              </Field>
              {/* Native date inputs: the platform picker is localised, keyboard
                  accessible and free. They yield `YYYY-MM-DD`; the transport
                  widens that to RFC 3339, which is what the backend demands. */}
              <Field label={t('reports.startDate')} htmlFor="report-start-date">
                <Input
                  id="report-start-date"
                  type="date"
                  value={details.startDate}
                  onChange={(event) => setDetail('startDate')(event.target.value)}
                />
              </Field>
              <Field label={t('reports.dueDate')} htmlFor="report-due-date">
                <Input
                  id="report-due-date"
                  type="date"
                  value={details.dueDate}
                  onChange={(event) => setDetail('dueDate')(event.target.value)}
                />
              </Field>
            </div>
          </div>
        )}
      </Modal>

      <ReportHistoryModal
        projectId={projectId}
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
      />
    </div>
  );
}

function MenuItem({
  icon: Icon,
  title,
  hint,
  onClick,
}: {
  icon: typeof FileCheck2;
  title: string;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="hover:bg-accent flex w-full items-start gap-2.5 rounded-md px-2 py-2 text-left transition-colors"
    >
      <Icon className="text-brand mt-0.5 size-4 shrink-0" aria-hidden />
      <span className="min-w-0">
        <span className="block text-sm font-medium">{title}</span>
        {hint && <span className="text-muted-foreground block text-xs">{hint}</span>}
      </span>
    </button>
  );
}
