'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertCircle, ImagePlus, Loader2, Save, Sparkles, X } from 'lucide-react';

import { useI18n, type Translate } from '@/core/i18n';
import { Button, Modal, Textarea } from '@/shared/ui';

import { urdApi } from '../api/urd.api';
import { useAnalyzeUrd, useSubmitResolutions, useUrdAnalysis } from '../hooks/use-urd';
import { resolvedCount, type EdgeCase, type UrdAnalysis } from '../services/completeness.service';
import { type Document } from '../schemas/document.schema';

/** Ảnh minh hoạ tối đa 5 MB — chặn ở client để không tốn một vòng lên server. */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * Phân tích edge case cho một tài liệu URD.
 *
 * Hai giai đoạn: chạy phân tích, rồi nhập hướng giải quyết cho từng case tìm
 * được. Giai đoạn đầu có animation vì phân tích thật mất vài chục giây — một
 * modal đứng im trong ngần ấy thời gian sẽ bị hiểu là treo.
 *
 * Từ 16/09/2026 modal gọi API thật (`urd/analyze`). Backend đòi tài liệu đã được
 * xác nhận `doc_type=urd` và revision có nguồn canonical; hook lo vế đầu, vế sau
 * nếu thiếu thì hiện thông báo chứ không quay vòng vô hạn.
 */
export function EdgeCaseModal({
  projectId,
  document,
  analysisId,
  onClose,
}: {
  projectId: string;
  /** Tài liệu đang phân tích. Null nghĩa là modal đóng. */
  document: Document | null;
  /**
   * Lần phân tích đã có của tài liệu này, lấy từ `urd-summary`. Có giá trị thì
   * mở lại nó; null nghĩa là chưa từng phân tích và sẽ chạy lần đầu.
   */
  analysisId: string | null;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const analyze = useAnalyzeUrd(projectId);
  const { mutateAsync: analyzeAsync } = analyze;
  const submit = useSubmitResolutions(projectId);
  // Đã có lần phân tích trước thì đọc lại, không chạy phân tích mới.
  const existing = useUrdAnalysis(projectId, document?.id ?? '', analysisId);

  // Bản nháp người dùng đang sửa, tách khỏi kết quả server trả về: gõ vào ô
  // không được ghi thẳng vào cache của TanStack Query.
  const [draft, setDraft] = useState<{ documentId: string | null; value: UrdAnalysis | null }>({
    documentId: null,
    value: null,
  });

  const documentId = document?.id ?? null;

  // Đổi tài liệu thì bỏ bản nháp cũ. Suy ra lúc render thay vì setState trong
  // effect, để không chớp qua kết quả của tài liệu trước dưới tiêu đề mới.
  if (draft.documentId !== documentId) {
    setDraft({ documentId, value: null });
  }

  // Chỉ chạy phân tích khi tài liệu CHƯA có lần phân tích nào. Đã có thì
  // `useUrdAnalysis` ở trên đọc lại, vì gọi `analyze` lúc đó bị backend từ chối
  // bằng `URD_ANALYSIS_ACTIVE`.
  //
  // Phụ thuộc vào `mutateAsync` chứ không phải cả object mutation: TanStack giữ
  // hàm này ổn định, còn object thì đổi mỗi lần trạng thái mutation đổi — dùng
  // nó sẽ chạy lại phân tích ngay khi lần chạy đầu vừa xong.
  useEffect(() => {
    if (!document || analysisId) return;

    let cancelled = false;
    analyzeAsync({
      documentId: document.id,
      version: document.version,
      docType: document.docType,
    })
      .then((result) => {
        if (!cancelled) setDraft({ documentId: document.id, value: result });
      })
      .catch(() => {
        // Lỗi đã nằm trong `analyze.error`; ở đây chỉ cần không set state.
      });

    return () => {
      cancelled = true;
    };
  }, [document, analysisId, analyzeAsync]);

  if (!document) return null;

  // Bản nháp đang sửa được ưu tiên; chưa gõ gì thì lấy bản server trả về.
  const result = draft.documentId === document.id ? (draft.value ?? existing.data ?? null) : null;

  /**
   * Sửa một case trong bản nháp.
   *
   * Khi mở lại một phân tích đã có, bản nháp còn rỗng và dữ liệu đang hiển thị
   * là của `existing.data`. Lần gõ đầu tiên vì thế phải *gieo* bản nháp từ dữ
   * liệu server rồi mới áp thay đổi — bỏ qua như trước thì mọi ký tự gõ vào ô
   * chưa có nội dung đều bị nuốt, ô nhìn như bị khoá.
   */
  const updateCase = (id: string, patch: Partial<EdgeCase>) =>
    setDraft((current) => {
      const base = current.value ?? existing.data;
      if (!base) return current;
      return {
        documentId: current.documentId,
        value: {
          ...base,
          cases: base.cases.map((item) => (item.id === id ? { ...item, ...patch } : item)),
        },
      };
    });

  const resolved = result ? resolvedCount(result.cases) : 0;

  const save = () => {
    if (!result) return;
    submit
      .mutateAsync({
        documentId: document.id,
        analysisId: result.analysis.id,
        // Chỉ gửi case thực sự đổi so với bản server đang giữ. Backend cộng
        // dồn qua nhiều lần lưu, nên gửi lại nguyên si những case cũ vừa thừa
        // vừa ghi đè công sức người khác nhập trong lúc modal đang mở.
        items: changedCases(result.cases, existing.data?.cases).map((item) => ({
          caseId: item.id,
          resolution: item.resolution.trim(),
          imageObjectKey: item.imageObjectKey,
        })),
      })
      .then(onClose)
      .catch(() => {
        // `submit.error` đã hiển thị dưới chân modal; giữ modal mở để không mất
        // những gì người dùng vừa gõ.
      });
  };

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
            <Button variant="outline" onClick={onClose} disabled={submit.isPending}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={save}
              disabled={
                submit.isPending || changedCases(result.cases, existing.data?.cases).length === 0
              }
            >
              {submit.isPending ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : (
                <Save aria-hidden />
              )}
              {submit.isPending ? t('edgeCase.saving') : t('edgeCase.save')}
            </Button>
          </>
        ) : undefined
      }
    >
      {analyze.isPending ? (
        <AnalyzingStage />
      ) : existing.isPending ? (
        <ReopeningStage />
      ) : analyze.isError || existing.isError ? (
        <FailureStage
          message={analyzeErrorMessage(analyze.error ?? existing.error, t)}
          onRetry={() => {
            if (analysisId) {
              void existing.refetch();
              return;
            }
            void analyzeAsync({
              documentId: document.id,
              version: document.version,
              docType: document.docType,
            })
              .then((value) => setDraft({ documentId: document.id, value }))
              .catch(() => undefined);
          }}
          retryLabel={t('edgeCase.retry')}
        />
      ) : !result ? null : result.cases.length === 0 ? (
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
                projectId={projectId}
                documentId={document.id}
                analysisId={result.analysis.id}
                onChange={(patch) => updateCase(item.id, patch)}
              />
            ))}
          </div>

          <p className="text-muted-foreground mt-4 text-xs">
            {t('completeness.caseCount', { done: resolved, total: result.cases.length })}
          </p>

          {submit.isError ? (
            <p className="text-status-failed mt-2 text-xs">{t('edgeCase.saveFailed')}</p>
          ) : null}
        </div>
      )}
    </Modal>
  );
}

/**
 * Những case người dùng đã sửa so với bản server đang giữ.
 *
 * So cả `resolution` lẫn ảnh: đổi mỗi ảnh mà không đổi chữ vẫn là một thay đổi
 * cần lưu. Case rỗng mà server cũng đang rỗng thì bỏ qua, nếu không lần lưu nào
 * cũng gửi đủ 15 case dù chỉ gõ một ô.
 */
function changedCases(
  current: readonly EdgeCase[],
  server: readonly EdgeCase[] | undefined
): EdgeCase[] {
  const before = new Map((server ?? []).map((item) => [item.id, item] as const));
  return current.filter((item) => {
    const original = before.get(item.id);
    const resolution = item.resolution.trim();
    if (!original) return resolution.length > 0;
    return (
      resolution !== (original.resolution ?? '').trim() ||
      item.imageObjectKey !== original.imageObjectKey
    );
  });
}

/**
 * Lỗi từ `analyze` gần như luôn là một điều kiện tiên quyết chưa đạt, và thông
 * báo thô của backend ("Nguồn canonical của revision chưa sẵn sàng") không nói
 * cho người dùng biết phải làm gì.
 *
 * Nhận diện theo `code` trước, chỉ dò chuỗi khi không có code: backend đặt mã
 * riêng `URD_NOT_CONFIRMED`, còn phần canonical chỉ trả `REQ_400` chung nên vẫn
 * phải dò văn bản. Sửa lời thông báo bên backend sẽ làm nhánh đó trượt, nhưng
 * lúc ấy vẫn còn câu báo lỗi chung chứ không vỡ giao diện.
 */
export function analyzeErrorMessage(error: unknown, t: Translate): string {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  const message =
    error && typeof error === 'object' && 'message' in error ? String(error.message) : '';

  if (code === 'URD_NOT_CONFIRMED') return t('edgeCase.notConfirmed');
  if (message.toLowerCase().includes('canonical')) return t('edgeCase.notReady');
  return t('edgeCase.analyzeFailed');
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

function FailureStage({
  message,
  onRetry,
  retryLabel,
}: {
  message: string;
  onRetry: () => void;
  retryLabel: string;
}) {
  return (
    <div className="py-12 text-center">
      <div className="bg-status-failed-bg text-status-failed mx-auto grid size-12 place-items-center rounded-full">
        <AlertCircle className="size-5" aria-hidden />
      </div>
      <p className="mx-auto mt-4 max-w-md text-sm">{message}</p>
      <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
        {retryLabel}
      </Button>
    </div>
  );
}

/** Đọc lại một phân tích đã có — nhanh hơn hẳn chạy phân tích nên không cần animation. */
function ReopeningStage() {
  const { t } = useI18n();
  return (
    <div className="text-muted-foreground py-14 text-center">
      <Loader2 className="mx-auto size-6 animate-spin" aria-hidden />
      <p className="mt-3 text-sm">{t('edgeCase.reopening')}</p>
    </div>
  );
}

function CaseCard({
  index,
  item,
  projectId,
  documentId,
  analysisId,
  onChange,
}: {
  index: number;
  item: EdgeCase;
  projectId: string;
  documentId: string;
  analysisId: string;
  onChange: (patch: Partial<EdgeCase>) => void;
}) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  const pickImage = (file: File) => {
    if (file.size > MAX_IMAGE_BYTES) {
      setImageError(t('edgeCase.imageTooLarge'));
      return;
    }
    setImageError(null);
    setUploading(true);
    urdApi
      .uploadCaseImage(projectId, documentId, analysisId, item.id, file)
      .then((key) => onChange({ imageObjectKey: key }))
      .catch(() => setImageError(t('edgeCase.analyzeFailed')))
      .finally(() => setUploading(false));
  };

  return (
    <div className="border-border rounded-xl border p-4">
      <div className="flex items-start gap-2.5">
        <span className="bg-status-queued-bg text-status-queued mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-semibold">
          {item.sequenceNo || index + 1}
        </span>
        <p className="min-w-0 flex-1 text-sm font-medium">{item.description}</p>
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

      <div className="mt-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            // Xoá giá trị để chọn lại đúng file vừa bỏ vẫn kích hoạt onChange.
            event.target.value = '';
            if (file) pickImage(file);
          }}
        />

        {item.imageObjectKey ? (
          <div className="border-border bg-surface-muted/40 flex items-center gap-2 rounded-md border px-2.5 py-1.5">
            <span className="text-muted-foreground min-w-0 flex-1 truncate text-xs">
              {t('edgeCase.imageAttached')}
            </span>
            <button
              type="button"
              onClick={() => onChange({ imageObjectKey: null })}
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
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <ImagePlus aria-hidden />
            )}
            {uploading ? t('edgeCase.uploading') : t('edgeCase.addImage')}
          </Button>
        )}

        {imageError ? <p className="text-status-failed mt-1 text-xs">{imageError}</p> : null}
      </div>
    </div>
  );
}
