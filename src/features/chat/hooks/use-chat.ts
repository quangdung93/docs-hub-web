'use client';

import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/core/api';

import { chatApi } from '../api/chat.api';
import type { ChatMessage } from '../schemas/chat.schema';

export const chatHistoryQueryOptions = (projectId: string) =>
  queryOptions({
    queryKey: queryKeys.chat.history(projectId),
    queryFn: ({ signal }) => chatApi.history(projectId, signal),
    staleTime: Infinity,
  });

export function useChatHistory(projectId: string) {
  return useQuery(chatHistoryQueryOptions(projectId));
}

/**
 * Ask a question. The user's message is appended optimistically so the bubble
 * appears instantly; the assistant reply is appended when it arrives. On failure
 * the optimistic message is rolled back to the pre-send snapshot.
 */
export function useAskQuestion(projectId: string) {
  const queryClient = useQueryClient();
  const key = queryKeys.chat.history(projectId);

  return useMutation({
    mutationFn: (question: string) => chatApi.ask(projectId, question),

    onMutate: async (question) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ChatMessage[]>(key) ?? [];

      const optimistic: ChatMessage = {
        id: `optimistic-${previous.length}`,
        role: 'user',
        content: question,
        citations: [],
        createdAt: new Date().toISOString(),
      };

      queryClient.setQueryData<ChatMessage[]>(key, [...previous, optimistic]);
      return { previous };
    },

    onSuccess: (answer) => {
      queryClient.setQueryData<ChatMessage[]>(key, (current = []) => [...current, answer]);
    },

    onError: (_error, _question, context) => {
      if (context) queryClient.setQueryData(key, context.previous);
    },
  });
}
