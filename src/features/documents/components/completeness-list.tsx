'use client';

import { useMemo, useState } from 'react';
import { FileCheck2, RotateCcw, Sparkles } from 'lucide-react';

import { useI18n } from '@/core/i18n';
import { Badge, Button, EmptyState, ErrorState, FileTypeIcon, Skeleton } from '@/shared/ui';

import { useDocuments } from '../hooks/use-documents';
import {
  completenessPercent,
  completenessTone,
  isUrdDocument,
  resolvedCount,
  type CompletenessResult,
} from '../services/completeness.service';
import { type Document } from '../schemas/document.schema';

import { EdgeCaseModal } from './edge-case-modal';

/**
 * Tab "Hoàn thiện" — đánh giá tài liệu URD đã đầy đủ chưa.
 *
 * Chỉ liệt kê tài liệu nhận diện được là URD (`isUrdDocument`), vì edge case là
 * khái niệm của tài liệu yêu cầu; một file Excel bảng thuật ngữ không có gì để
 * đánh giá, và liệt kê nó ra chỉ làm loãng danh sách.
 *
 * Kết quả phân tích giữ trong state của màn hình, **không persist**: backend
 * chưa có chỗ lưu (rà Swagger 14/09/2026). Nghĩa là F5 là mất — đây là giới hạn
 * đã biết của bản mô phỏng, không phải lỗi.
 */
export function CompletenessList({ projectId }: { projectId: string }) {
  const { t } = useI18n();
  const { data: documents, isPending, isError, error, refetch } = useDocuments(projectId);

  /** documentId → kết quả phân tích gần nhất. */
  const [results, setResults] = useState<Record<string, CompletenessResult>>({});
  const [openedId, setOpenedId] = useState<string | null>(null);

  const urdDocuments = useMemo(
    () => (documents ?? []).filter((document) => !document.isDeleted && isUrdDocument(document)),
    [documents]
  );

  if (isPending) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-16" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        error={error}
        title={t('documents.loadError')}
        fallbackMessage={t('error.loadFailed')}
        retryLabel={t('common.retry')}
        onRetry={() => void refetch()}
        className="py-10"
      />
    );
  }

  if (urdDocuments.length === 0) {
    return (
      <EmptyState
        icon={FileCheck2}
        title={t('completeness.empty')}
        description={t('completeness.emptyHint')}
        className="py-12"
      />
    );
  }

  const opened = urdDocuments.find((document) => document.id === openedId) ?? null;

  return (
    <div className="space-y-2">
      <p className="text-muted-foreground text-xs">{t('completeness.hint')}</p>

      {urdDocuments.map((document) => (
        <CompletenessRow
          key={document.id}
          document={document}
          result={results[document.id] ?? null}
          onOpen={() => setOpenedId(document.id)}
        />
      ))}

      {/* Nói thẳng đây là dữ liệu mô phỏng. Một màn hình trông như đã chạy thật
          mà thực ra chưa nối API là thứ dễ bị hiểu nhầm nhất khi demo. */}
      <p className="text-muted-foreground pt-1 text-xs italic">{t('completeness.mockNotice')}</p>

      <EdgeCaseModal
        document={opened}
        initialResult={opened ? (results[opened.id] ?? null) : null}
        onClose={() => setOpenedId(null)}
        onSave={(documentId, result) =>
          setResults((current) => ({ ...current, [documentId]: result }))
        }
      />
    </div>
  );
}

function CompletenessRow({
  document,
  result,
  onOpen,
}: {
  document: Document;
  result: CompletenessResult | null;
  onOpen: () => void;
}) {
  const { t } = useI18n();

  const percent = result ? completenessPercent(result.cases) : null;
  const tone = percent === null ? null : completenessTone(percent);

  return (
    <div className="border-border flex items-center justify-between gap-3 rounded-lg border p-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <FileTypeIcon fileName={document.fileName ?? document.name} />
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-medium">{document.name}</p>

          {result ? (
            <div className="mt-1.5 w-48">
              <div className="text-muted-foreground flex items-center justify-between text-xs">
                <span className="font-semibold">{percent}%</span>
                <span>
                  {t('completeness.caseCount', {
                    done: resolvedCount(result.cases),
                    total: result.cases.length,
                  })}
                </span>
              </div>
              {/* Thanh tiến độ vẽ tay thay vì dùng `Progress`: ở đây cần đổi màu
                  theo ngưỡng, mà `Progress` chỉ có một màu brand. */}
              <div className="bg-muted mt-1 h-1.5 w-full overflow-hidden rounded-full">
                <div
                  className={
                    tone === 'indexed'
                      ? 'bg-status-indexed h-full rounded-full transition-[width] duration-500'
                      : tone === 'queued'
                        ? 'bg-status-queued h-full rounded-full transition-[width] duration-500'
                        : 'bg-status-failed h-full rounded-full transition-[width] duration-500'
                  }
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          ) : (
            <Badge variant="neutral" className="mt-1">
              {t('completeness.notAnalyzed')}
            </Badge>
          )}
        </div>
      </div>

      <Button variant="outline" size="sm" onClick={onOpen} className="shrink-0">
        {result ? <RotateCcw aria-hidden /> : <Sparkles aria-hidden />}
        {result ? t('completeness.reanalyze') : t('completeness.notAnalyzed')}
      </Button>
    </div>
  );
}
