'use client';

import { useEffect, useState } from 'react';
import { ImagePlus, Save, Sparkles, X } from 'lucide-react';

import { useI18n } from '@/core/i18n';
import { Badge, Button, Modal, Textarea } from '@/shared/ui';

import {
  analyzeDocument,
  type CompletenessResult,
  type EdgeCase,
} from '../services/completeness.service';
import { type Document } from '../schemas/document.schema';

/**
 * Phân tích edge case cho một tài liệu URD.
 *
 * Hai giai đoạn: chạy phân tích, rồi nhập hướng giải quyết cho từng case tìm
 * được. Giai đoạn đầu có animation vì phân tích thật sẽ mất vài chục giây —
 * một modal đứng im trong ngần ấy thời gian sẽ bị hiểu là treo.
 *
 * Kết quả phân tích hiện là **dữ liệu mô phỏng** (xem `completeness.service`).
 * Modal vẫn được viết như thể đang gọi API thật: có trạng thái đang chạy, có
 * huỷ giữa chừng, có lưu — để khi endpoint xuất hiện thì chỉ đổi một lời gọi.
 */
export function EdgeCaseModal({
  document,
  initialResult,
  onClose,
  onSave,
}: {
  /** Tài liệu đang phân tích. Null nghĩa là modal đóng. */
  document: Document | null;
  /** Kết quả lần phân tích trước, nếu có — mở lại thì không chạy phân tích nữa. */
  initialResult: CompletenessResult | null;
  onClose: () => void;
  onSave: (documentId: string, result: CompletenessResult) => void;
}) {
  const { t } = useI18n();
  const [state, setState] = useState<{
    documentId: string | null;
    result: CompletenessResult | null;
  }>({ documentId: document?.id ?? null, result: initialResult });

  // Reset lúc render chứ không trong effect: giá trị này suy ra từ `document`,
  // và một setState trong effect sẽ render hai lần, chớp qua kết quả của tài
  // liệu trước dưới tiêu đề của tài liệu mới.
  if (state.documentId !== (document?.id ?? null)) {
    setState({ documentId: document?.id ?? null, result: initialResult });
  }

  // Chỉ effect lo phần bất đồng bộ. `cancelled` chặn setState sau khi modal đã
  // đóng — người dùng đóng giữa chừng là chuyện thường với thao tác chạy lâu.
  useEffect(() => {
    if (!document || initialResult) return;

    let cancelled = false;
    void analyzeDocument(document).then((analysed) => {
      if (!cancelled) setState({ documentId: document.id, result: analysed });
    });

    return () => {
      cancelled = true;
    };
  }, [document, initialResult]);

  if (!document) return null;

  const result = state.documentId === document.id ? state.result : null;

  const updateCase = (id: string, patch: Partial<EdgeCase>) =>
    setState((current) =>
      current.result
        ? {
            ...current,
            result: {
              ...current.result,
              cases: current.result.cases.map((item) =>
                item.id === id ? { ...item, ...patch } : item
              ),
            },
          }
        : current
    );

  const resolved = result?.cases.filter((item) => item.resolution.trim()).length ?? 0;

  return (
    <Modal
      open
      title={`${t('edgeCase.modalTitle')} — ${document.name}`}
      icon={Sparkles}
      onClose={onClose}
      className="w-[min(48rem,calc(100vw-2rem))]"
      footer={
        result && result.cases.length > 0 ? (
          <>
            <Button variant="outline" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => {
                onSave(document.id, result);
                onClose();
              }}
            >
              <Save aria-hidden />
              {t('edgeCase.save')}
            </Button>
          </>
        ) : undefined
      }
    >
      {/* Chưa có `result` nghĩa là đang chạy phân tích: state chỉ được điền khi
          `analyzeDocument` trả về, nên không cần thêm cờ `isAnalyzing` riêng. */}
      {!result ? (
        <AnalyzingStage />
      ) : result.cases.length === 0 ? (
        <p className="text-muted-foreground py-12 text-center text-sm">{t('edgeCase.noCases')}</p>
      ) : (
        <div className="max-h-[60vh] overflow-auto">
          <p className="text-sm font-medium">
            {t('edgeCase.found', { count: result.cases.length })}
          </p>
          <p className="text-muted-foreground mt-1 text-xs">{t('edgeCase.foundHint')}</p>

          <div className="mt-4 space-y-3">
            {result.cases.map((item, index) => (
              <CaseCard
                key={item.id}
                index={index}
                item={item}
                onChange={(patch) => updateCase(item.id, patch)}
              />
            ))}
          </div>

          <p className="text-muted-foreground mt-4 text-xs">
            {t('completeness.caseCount', { done: resolved, total: result.cases.length })}
          </p>
        </div>
      )}
    </Modal>
  );
}

/**
 * Trạng thái đang phân tích.
 *
 * Ba chấm nảy so le thay cho một spinner tròn: phân tích là việc chạy theo
 * từng bước chứ không phải chờ một phản hồi, nên nhịp đập đọc đúng hơn.
 */
function AnalyzingStage() {
  const { t } = useI18n();

  return (
    <div className="py-14 text-center">
      <div className="bg-brand-subtle text-brand mx-auto grid size-14 place-items-center rounded-full">
        <Sparkles className="size-6 animate-pulse" aria-hidden />
      </div>

      <p className="mt-4 text-sm font-medium">{t('edgeCase.analyzing')}</p>
      <p className="text-muted-foreground mt-1 text-xs">{t('edgeCase.analyzingHint')}</p>

      <div className="mt-5 flex items-center justify-center gap-1.5" aria-hidden>
        {[0, 1, 2].map((dot) => (
          <span
            key={dot}
            className="bg-brand size-2 animate-bounce rounded-full"
            // Lệch pha để ba chấm nảy so le thay vì cùng nhịp.
            style={{ animationDelay: `${dot * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
}

function CaseCard({
  index,
  item,
  onChange,
}: {
  index: number;
  item: EdgeCase;
  onChange: (patch: Partial<EdgeCase>) => void;
}) {
  const { t } = useI18n();

  return (
    <div className="border-border rounded-xl border p-4">
      <div className="flex items-start gap-2.5">
        <span className="bg-status-queued-bg text-status-queued mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-semibold">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <Badge variant="neutral" className="text-[10px] uppercase">
            {item.category}
          </Badge>
          <p className="mt-1.5 text-sm font-medium">{item.title}</p>
        </div>
      </div>

      <div className="mt-3">
        <label
          htmlFor={`resolution-${item.id}`}
          className="text-muted-foreground mb-1.5 block text-xs font-medium"
        >
          {t('edgeCase.resolution')}
        </label>
        <Textarea
          id={`resolution-${item.id}`}
          rows={2}
          value={item.resolution}
          placeholder={t('edgeCase.resolutionPlaceholder')}
          onChange={(event) => onChange({ resolution: event.target.value })}
        />
      </div>

      {/* Chưa có API lưu file, nên nút này mới chỉ ghi nhận tên ảnh — đủ để thấy
          luồng, chưa upload đi đâu. Thay bằng Dropzone khi có endpoint. */}
      <div className="mt-2">
        {item.imageName ? (
          <div className="border-border bg-surface-muted/40 flex items-center gap-2 rounded-md border px-2.5 py-1.5">
            <span className="text-muted-foreground min-w-0 flex-1 truncate text-xs">
              {item.imageName} · {t('edgeCase.imageAttached')}
            </span>
            <button
              type="button"
              onClick={() => onChange({ imageName: null })}
              aria-label={t('edgeCase.removeImage')}
              className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/40 grid size-5 shrink-0 place-items-center rounded focus-visible:ring-2 focus-visible:outline-none"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onChange({ imageName: `minh_hoa_${index + 1}.png` })}
          >
            <ImagePlus aria-hidden />
            {t('edgeCase.addImage')}
          </Button>
        )}
      </div>
    </div>
  );
}
