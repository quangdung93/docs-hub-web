'use client';

import { useState } from 'react';
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/core/api';

import { chatApi } from '../api/chat.api';
import {
  type ChatMessage,
  type ChatScope,
  type Conversation,
  DEFAULT_SCOPE,
} from '../schemas/chat.schema';

export const conversationsQueryOptions = (projectId: string) =>
  queryOptions({
    queryKey: queryKeys.chat.conversations(projectId),
    queryFn: ({ signal }) => chatApi.list(projectId, signal),
    staleTime: 30_000,
  });

export const conversationQueryOptions = (projectId: string, conversationId: string | null) =>
  queryOptions({
    queryKey: queryKeys.chat.conversation(projectId, conversationId ?? 'none'),
    queryFn: ({ signal }) => chatApi.detail(projectId, conversationId!, signal),
    enabled: Boolean(conversationId),
    staleTime: Infinity,
  });

export function useConversations(projectId: string) {
  return useQuery(conversationsQueryOptions(projectId));
}

/**
 * The chat screen's single entry point.
 *
 * Messages belong to a conversation, not to a project, so the first question in
 * a session has to create one. That happens lazily inside `ask` — opening the
 * screen must not leave an empty conversation behind for every visitor who never
 * types anything.
 *
 * The active conversation id is component state, not a store: nothing outside
 * this screen reads it, and it should reset when the user navigates away.
 */
export function useChat(projectId: string) {
  const queryClient = useQueryClient();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [scope, setScope] = useState<ChatScope>(DEFAULT_SCOPE);

  const conversation = useQuery(conversationQueryOptions(projectId, conversationId));

  const key = queryKeys.chat.conversation(projectId, conversationId ?? 'none');

  const ask = useMutation({
    /**
     * Returns the conversation id alongside the answer. `onSuccess` needs it, and
     * reading it from `conversationId` there is wrong: on the first question that
     * state is still null in the callback's closure — `setConversationId` below
     * only schedules a re-render, it does not update the variable the running
     * callbacks captured. Returning it as data is the only value that cannot be
     * stale.
     */
    mutationFn: async (question: string) => {
      let id = conversationId;

      if (!id) {
        // Title the conversation after the first question, the way every chat
        // product does — the backend accepts any string and never derives one.
        const created = await chatApi.create(projectId, question.slice(0, 80), scope);
        id = created.id;
        setConversationId(id);
        queryClient.setQueryData(queryKeys.chat.conversation(projectId, id), created);
        void queryClient.invalidateQueries({
          queryKey: queryKeys.chat.conversations(projectId),
        });
      }

      const answer = await chatApi.ask(projectId, id, question);
      return { conversationId: id, answer };
    },

    // The question bubble appears instantly; the answer is appended on arrival.
    onMutate: async (question) => {
      // Captured here so `onError` rolls back the key this write targeted, even
      // if `conversationId` changed in between.
      const activeKey = key;
      await queryClient.cancelQueries({ queryKey: activeKey });
      const previous = queryClient.getQueryData<Conversation>(activeKey);

      const optimistic: ChatMessage = {
        id: `optimistic-${Date.now()}`,
        role: 'user',
        content: question,
        citations: [],
        createdAt: new Date().toISOString(),
      };

      // Only an existing conversation has something to append to. For the first
      // question the cache is legitimately empty; `onSuccess` inserts the pair.
      if (previous) {
        queryClient.setQueryData<Conversation>(activeKey, {
          ...previous,
          messages: [...previous.messages, optimistic],
        });
      }

      return { previous, optimistic, key: activeKey };
    },

    onSuccess: ({ conversationId: id, answer }, _question, context) => {
      const currentKey = queryKeys.chat.conversation(projectId, id);
      queryClient.setQueryData<Conversation>(currentKey, (current) => {
        if (!current) return current;
        // A conversation created inside this same mutation has no optimistic
        // bubble yet — `onMutate` ran against the "none" key, before the id
        // existed — so both rows are appended here.
        const hasOptimistic = current.messages.some((m) => m.id === context.optimistic.id);
        const base = hasOptimistic ? current.messages : [...current.messages, context.optimistic];
        return { ...current, messages: [...base, answer] };
      });
    },

    onError: (_error, _question, context) => {
      // Rolls back against the key `onMutate` wrote to. A first question has no
      // previous state to restore — nothing was written, so nothing to undo.
      if (context?.previous) queryClient.setQueryData(context.key, context.previous);
    },
  });

  return {
    conversationId,
    setConversationId,
    scope,
    setScope,
    messages: conversation.data?.messages ?? [],
    isLoading: conversation.isLoading,
    ask,
  };
}
