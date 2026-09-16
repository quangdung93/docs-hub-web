'use client';

import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/core/api';

import { urdApi } from '../api/urd.api';
import { type UrdSummary } from '../services/completeness.service';

/**
 * Độ hoàn thiện URD của cả project.
 *
 * Một lời gọi cho toàn bảng thay vì mỗi dòng một lời gọi — backend đã gom sẵn ở
 * `documents/urd-summary`. Trả về map theo `documentId` để mỗi dòng tra cứu
 * bằng khóa thay vì quét mảng.
 */
export const urdSummaryQueryOptions = (projectId: string) =>
  queryOptions({
    queryKey: queryKeys.urd.summary(projectId),
    queryFn: ({ signal }) => urdApi.summary(projectId, signal),
    staleTime: 30_000,
    select: (items: UrdSummary[]) => new Map(items.map((item) => [item.documentId, item] as const)),
  });

export function useUrdSummary(projectId: string) {
  return useQuery(urdSummaryQueryOptions(projectId));
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
      return urdApi.analyze(projectId, input.documentId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.urd.summary(projectId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.documents.all });
    },
  });
}

/** Mở lại một lần phân tích đã chạy trước đó. */
export function useUrdAnalysis(projectId: string, documentId: string, analysisId: string | null) {
  return useQuery({
    queryKey: queryKeys.urd.analysis(projectId, documentId, analysisId ?? 'none'),
    queryFn: ({ signal }) => urdApi.detail(projectId, documentId, analysisId!, signal),
    enabled: Boolean(analysisId),
    staleTime: Infinity,
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
