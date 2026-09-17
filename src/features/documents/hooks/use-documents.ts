'use client';

import { useMemo } from 'react';
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/core/api';

import {
  documentsApi,
  reportsApi,
  versionsApi,
  type DocumentListParams,
  type GenerateReportInput,
} from '../api/documents.api';

export const documentListQueryOptions = (projectId: string, params: DocumentListParams = {}) =>
  queryOptions({
    queryKey: queryKeys.documents.list(projectId, params),
    queryFn: ({ signal }) => documentsApi.list(projectId, params, signal),
    staleTime: 15_000,
    /**
     * Tự làm mới khi còn tài liệu đang chạy pipeline ingest.
     *
     * Ingest mất từ vài chục giây tới vài phút, và người dùng thường đứng luôn ở
     * bảng này chờ. Không có polling thì "Đang xử lý" nằm đó vĩnh viễn cho tới
     * khi họ tự F5 — mà không có gì trên màn hình gợi ý là phải F5.
     *
     * Chỉ chạy khi thực sự có dòng chưa xong: bảng toàn tài liệu đã lập chỉ mục
     * thì dừng hẳn, không tạo request nền vô ích. `failed` cũng coi là xong —
     * pipeline đã dừng, đợi thêm không đổi được gì.
     *
     * Nhịp 10 giây chứ không phải 5: `list` đang là N+1 (một lời gọi danh sách
     * rồi mỗi dòng một lời gọi chi tiết, vì `GET /documents` không trả revision
     * kèm theo), nên một vòng làm mới bảng 9 dòng tốn 10 request. Ingest mất
     * hàng chục giây tới vài phút, chờ thêm 5 giây không ai thấy khác biệt,
     * trong khi số request giảm một nửa. Rút xuống khi nào backend trả revision
     * inline — xem `docs/api-gaps.md`.
     */
    refetchInterval: (query) =>
      query.state.data?.some(
        (document) => document.status === 'processing' || document.status === 'queued'
      )
        ? 10_000
        : false,
  });

export function useDocuments(projectId: string, params: DocumentListParams = {}) {
  return useQuery(documentListQueryOptions(projectId, params));
}

export const documentDetailQueryOptions = (projectId: string, documentId: string) =>
  queryOptions({
    queryKey: queryKeys.documents.detail(projectId, documentId),
    queryFn: ({ signal }) => documentsApi.detail(projectId, documentId, signal),
    staleTime: 15_000,
  });

/**
 * Document detail — the only place revisions (and therefore real status, size
 * and format) are available, because the list endpoint omits them.
 *
 * Polls while ingestion is in flight: the backend has no push channel, so this
 * is how a row moves from "processing" to "indexed" without a manual refresh.
 * Polling stops as soon as the document settles, so an idle screen is silent.
 */
export function useDocumentDetail(projectId: string, documentId: string | null) {
  return useQuery({
    ...documentDetailQueryOptions(projectId, documentId ?? ''),
    enabled: Boolean(documentId),
    refetchInterval: (query) => {
      const status = query.state.data?.document.status;
      return status === 'queued' || status === 'processing' ? 3_000 : false;
    },
    // Must beat the 15s staleTime above, or the 3s interval fires and every
    // refetch is answered from cache — the row would look frozen mid-ingestion.
    staleTime: 0,
  });
}

/**
 * Poll one revision's ingestion pipeline.
 *
 * Polling stops the moment the stage stops running — a finished or failed
 * revision must not keep a timer alive, and a failure that kept `isRunning` true
 * would poll forever against a row that will never change.
 */
export function useRevisionStatus(
  projectId: string,
  documentId: string | null,
  revisionId: string | null
) {
  return useQuery({
    queryKey: queryKeys.documents.revisionStatus(projectId, documentId ?? '', revisionId ?? ''),
    queryFn: () => documentsApi.revisionStatus(projectId, documentId!, revisionId!),
    enabled: Boolean(documentId && revisionId),
    refetchInterval: (query) => (query.state.data?.stage.isRunning ? 3_000 : false),
    // The provider sets a global `staleTime: 60_000`. Polling data is stale the
    // moment it arrives — leave it and the interval fires but every refetch is
    // served from cache, so the pipeline appears frozen on its first state.
    staleTime: 0,
  });
}

/** Draft versions an upload can be scoped to. */
export const projectVersionsQueryOptions = (projectId: string) =>
  queryOptions({
    queryKey: queryKeys.versions.list(projectId),
    queryFn: ({ signal }) => versionsApi.list(projectId, signal),
    staleTime: 60_000,
  });

export function useProjectVersions(projectId: string) {
  return useQuery(projectVersionsQueryOptions(projectId));
}

/**
 * Version id → label, for rendering "which version is this document in".
 *
 * A document row carries only the id; every screen that shows a version would
 * otherwise rebuild this map itself. Returns a plain lookup function so a caller
 * inside a render loop does not pay for a `find` per row.
 */
export function useVersionLabels(projectId: string) {
  const { data: versions } = useProjectVersions(projectId);

  return useMemo(() => {
    const byId = new Map((versions ?? []).map((version) => [version.id, version.label]));
    return {
      versions: versions ?? [],
      // Falls back to a short id rather than an empty cell: an unlabelled
      // version still tells the reader the document is scoped to *something*.
      labelOf: (versionId: string | null): string | null =>
        versionId ? (byId.get(versionId) ?? versionId.slice(0, 8)) : null,
    };
  }, [versions]);
}

/** Past report exports, newest first. */
export function useReportHistory(projectId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.reports.history(projectId),
    queryFn: ({ signal }) => reportsApi.history(projectId, signal),
    // The download URLs are signed for 900s, so a cached page of them goes stale
    // in a way a normal list does not — refetch rather than hand out dead links.
    staleTime: 60_000,
    enabled,
  });
}

/**
 * Generate a report through RAGFlow.
 *
 * Deliberately not optimistic and deliberately slow-tolerant: generation takes
 * tens of seconds, and the caller shows a pending state for the whole time. On
 * success the history list is invalidated, because the new report belongs there.
 */
export function useGenerateReport(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: GenerateReportInput) => reportsApi.generate(projectId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.reports.all });
    },
  });
}

export function useCreateProjectVersion(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { label: string; note?: string }) =>
      versionsApi.create(projectId, input.label, input.note),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.versions.all });
    },
  });
}

/** Deleting a document also changes the project's document counter, so both
 *  caches are invalidated — that is exactly why keys live in one factory. */
export function useDeleteDocument(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (documentId: string) => documentsApi.remove(projectId, documentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.documents.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
  });
}

/** Rename a document. `version` guards against a concurrent edit (CONFLICT_VERSION). */
export function useUpdateDocument(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      documentId: string;
      title: string;
      description?: string;
      version: number;
    }) => documentsApi.update(projectId, input.documentId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.documents.all });
    },
  });
}

/** Re-run ingestion after a failure. */
export function useRetryRevision(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { documentId: string; revisionId: string }) =>
      documentsApi.retryRevision(projectId, input.documentId, input.revisionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.documents.all });
    },
  });
}
