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
import { Button, Field, messageOf, Modal, Select, showErrorToast } from '@/shared/ui';

import { type ReportFormat, type ReportType } from '../api/documents.api';
import { useGenerateReport, useProjectVersions } from '../hooks/use-documents';
import { reportDownloadHref } from '../services/report.service';

import { ReportHistoryModal } from './report-history-modal';

/**
 * "Xuất báo cáo" — mọi báo cáo dự án xuất được đều đi qua đây.
 *
 * Tất cả đều dùng `POST .../projects/{id}/reports`: RAGFlow đọc tài liệu rồi
 * viết báo cáo, trả về một presigned URL. Mất vài chục giây và có thể hỏng vì
 * nội dung chứ không phải vì request — `uat` trả REQ_400 "Không tìm thấy User
 * Story/Acceptance Criteria" khi tài liệu dự án không có gì để dựa vào.
 *
 * Nhánh template ISC (`POST .../documents/uat-report`) đã gỡ khỏi giao diện:
 * nó chỉ điền biểu mẫu rồi liệt kê tên tài liệu, không sinh test case nào, nên
 * file xuất ra gần như trống phần nghiệp vụ. Transport `exportUatReport` vẫn
 * còn trong `documents.api.ts` cho trường hợp cần bật lại.
 */
const REPORT_FORMATS = ['xlsx', 'pdf'] as const;

/** Giá trị canh cho "không lọc theo phiên bản" — Select cần một chuỗi thật. */
const ALL_VERSIONS = 'all';

export function ExportReportMenu({ projectId }: { projectId: string }) {
  const { t } = useI18n();

  const [menuOpen, setMenuOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [kind, setKind] = useState<ReportType | null>(null);
  const [format, setFormat] = useState<ReportFormat>('xlsx');
  const [versionId, setVersionId] = useState<string>(ALL_VERSIONS);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: versions } = useProjectVersions(projectId);
  const generateReport = useGenerateReport(projectId);

  // Đóng khi bấm ra ngoài hoặc nhấn Escape. Giới hạn trong container để một cú
  // bấm vào chính menu (chọn loại báo cáo) không tự đóng menu trước.
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

  const openDialog = (next: ReportType) => {
    setKind(next);
    setMenuOpen(false);
  };

  /**
   * Tải file về máy.
   *
   * Đi qua `/api/storage-get` chứ không trỏ thẳng vào presigned URL. Hai lý do
   * đều quan trọng: `connect-src 'self'` chặn trang fetch tới storage, và một
   * href khác origin thì thuộc tính `download` bị bỏ qua — file sẽ lưu theo
   * tên object key dạng UUID.
   */
  const runGenerate = async (reportType: ReportType) => {
    try {
      const result = await generateReport.mutateAsync({
        reportType,
        format,
        projectVersionId: versionId === ALL_VERSIONS ? undefined : versionId,
      });

      const link = document.createElement('a');
      link.href = reportDownloadHref(
        result.download_url,
        result.report.report_type,
        result.report.format,
        result.report.created_at
      );
      link.click();
      setKind(null);
    } catch (error) {
      // Lỗi do nội dung cũng rơi vào đây — "Không tìm thấy User Story/Acceptance
      // Criteria nào trong tài liệu dự án" là backend đang nói với người dùng
      // rằng tài liệu thiếu thứ báo cáo này cần, nên hiển thị nguyên văn.
      showErrorToast(messageOf(error, t('reports.generateFailed')));
    }
  };

  const dialogTitle =
    kind === 'planning'
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
        icon={kind === 'uat' ? FileCheck2 : Sparkles}
        onClose={() => setKind(null)}
        className="w-[min(40rem,calc(100vw-2rem))]"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setKind(null)}
              disabled={generateReport.isPending}
            >
              {t('common.cancel')}
            </Button>
            <Button
              disabled={generateReport.isPending}
              onClick={() => {
                if (kind) void runGenerate(kind);
              }}
            >
              <Download aria-hidden />
              {generateReport.isPending ? t('reports.generating') : t('reports.export')}
            </Button>
          </>
        }
      >
        <p className="text-muted-foreground">{t('reports.generatingHint')}</p>

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
