'use client';

import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/core/api';

import { documentsApi, versionsApi, type DocumentListParams } from '../api/documents.api';

export const documentListQueryOptions = (projectId: string, params: DocumentListParams = {}) =>
  queryOptions({
    queryKey: queryKeys.documents.list(projectId, params),
    queryFn: ({ signal }) => documentsApi.list(projectId, params, signal),
    staleTime: 15_000,
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

export function useCreateProjectVersion(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (label: string) => versionsApi.create(projectId, label),
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
