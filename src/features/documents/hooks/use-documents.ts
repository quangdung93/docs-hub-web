'use client';

import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/core/api';

import { documentsApi } from '../api/documents.api';

export const documentListQueryOptions = (projectId: string) =>
  queryOptions({
    queryKey: queryKeys.documents.list(projectId),
    queryFn: ({ signal }) => documentsApi.list(projectId, signal),
    staleTime: 15_000,
  });

export function useDocuments(projectId: string) {
  return useQuery(documentListQueryOptions(projectId));
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
