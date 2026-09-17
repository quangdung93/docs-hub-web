'use client';

import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/core/api';

import { urdApi } from '../api/urd.api';
import { type UrdSummary } from '../services/completeness.service';

/**
 * `analysis_id` của lần phân tích đang dở, lấy từ lỗi `URD_ANALYSIS_ACTIVE`.
 * Trả null cho mọi lỗi khác để nơi gọi ném tiếp.
 */
export function activeAnalysisId(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;
  if (!('code' in error) || error.code !== 'URD_ANALYSIS_ACTIVE') return null;
  const details = 'details' in error ? error.details : null;
  if (!details || typeof details !== 'object') return null;
  const id = (details as Record<string, unknown>).analysis_id;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

/**
 * Độ hoàn thiện URD của cả project.
 *
 * Một lời gọi cho toàn bảng thay vì mỗi dòng một lời gọi — backend đã gom sẵn ở
 * `documents/urd-summary`. Trả về map theo `documentId` để mỗi dòng tra cứu
 * bằng khóa thay vì quét mảng.
 */
export const urdSummaryQueryOptions = (projectId: string, hasPending = false) =>
  queryOptions({
    queryKey: queryKeys.urd.summary(projectId),
    queryFn: ({ signal }) => urdApi.summary(projectId, signal),
    // Cùng nhịp với danh sách tài liệu khi còn dòng đang xử lý. Hai truy vấn này
    // vẽ chung một hàng: để riêng nhịp thì trạng thái đã đổi sang "Đã lập chỉ
    // mục" mà ô "Hoàn thiện" vẫn trống thêm vài chục giây nữa, trông như hỏng.
    staleTime: hasPending ? 0 : 30_000,
    refetchInterval: hasPending ? 10_000 : false,
    select: (items: UrdSummary[]) => new Map(items.map((item) => [item.documentId, item] as const)),
  });

/**
 * @param hasPending còn tài liệu đang chạy ingest hay không — bật polling cho
 * khớp nhịp với danh sách tài liệu.
 */
export function useUrdSummary(projectId: string, hasPending = false) {
  return useQuery(urdSummaryQueryOptions(projectId, hasPending));
}

/**
 * Chạy phân tích edge case cho một tài liệu.
 *
 * Tự xác nhận `doc_type=urd` trước khi phân tích khi tài liệu chưa được xác
 * nhận: backend bắt buộc bước này, và bắt người dùng bấm hai nút cho một ý định
 * duy nhất là thừa. `version` phải là giá trị vừa đọc từ tài liệu vì backend
 * dùng nó để chống ghi đè.
 */
export function useAnalyzeUrd(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { documentId: string; version: number; docType: string | null }) => {
      if (input.docType !== 'urd') {
        await urdApi.confirmUrd(projectId, input.documentId, input.version);
      }

      try {
        return await urdApi.analyze(projectId, input.documentId);
      } catch (error) {
        // Tài liệu đang có phân tích dở dang: backend từ chối tạo lần chạy mới
        // và đưa luôn `analysis_id` trong `details`. Mở lại lần đó thay vì báo
        // lỗi — người dùng bấm "Phân tích" là muốn làm tiếp, không phải muốn
        // xoá công sức đã nhập.
        const active = activeAnalysisId(error);
        if (!active) throw error;
        return urdApi.detail(projectId, input.documentId, active);
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.urd.summary(projectId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.documents.all });
    },
  });
}

/**
 * Mở lại một lần phân tích đã chạy trước đó.
 *
 * `staleTime: 0` chứ không phải `Infinity`: người dùng làm nhiều đợt (giải quyết
 * vài case, đóng, hôm sau mở lại), nên mỗi lần mở phải đọc lại server thay vì
 * lấy bản cache có thể đã cũ hơn những gì chính họ vừa lưu ở máy khác.
 */
export function useUrdAnalysis(projectId: string, documentId: string, analysisId: string | null) {
  return useQuery({
    queryKey: queryKeys.urd.analysis(projectId, documentId, analysisId ?? 'none'),
    queryFn: ({ signal }) => urdApi.detail(projectId, documentId, analysisId!, signal),
    enabled: Boolean(analysisId),
    staleTime: 0,
  });
}

/**
 * Lưu hướng giải quyết.
 *
 * Làm mới cả danh sách tài liệu chứ không riêng phần tóm tắt: lưu đủ số case thì
 * backend sinh một revision URD mới, nên bảng tài liệu cũng đã cũ.
 */
export function useSubmitResolutions(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      documentId: string;
      analysisId: string;
      items: { caseId: string; resolution: string; imageObjectKey?: string | null }[];
    }) => urdApi.submitResolutions(projectId, input.documentId, input.analysisId, input.items),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.urd.summary(projectId) });
      if (result.newRevisionCreated) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.documents.all });
      }
    },
  });
}
