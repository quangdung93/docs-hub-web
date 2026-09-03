'use client';

import { useRef, useState } from 'react';
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

  /** The bubble `onMutate` just wrote, so `mutationFn` can re-key it alone. */
  const pendingMessage = useRef<ChatMessage | null>(null);

  /**
   * Cache slot for a conversation that does not exist yet. Shared by every new
   * conversation in the session, so it must be cleared once its contents are
   * adopted under a real id — otherwise the next one inherits the last question.
   */
  const NEW_CONVERSATION_KEY = queryKeys.chat.conversation(projectId, 'none');
  const key = conversationId
    ? queryKeys.chat.conversation(projectId, conversationId)
    : NEW_CONVERSATION_KEY;

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

        // The optimistic bubble was written under the "none" key, because no id
        // existed when `onMutate` ran. Carry it across, or the moment
        // `setConversationId` re-renders the component onto the real key the
        // question disappears again — the server's fresh conversation has no
        // messages in it yet.
        //
        // Only *this* mutation's bubble moves. `onMutate` stashes it in a ref
        // because TanStack does not pass its context here, and reading the
        // "none" key wholesale is what caused the bug: that slot is shared by
        // every new conversation in the session, so it still held the previous
        // one's question and dragged it into the new transcript.
        const optimistic = pendingMessage.current;
        queryClient.setQueryData<Conversation>(queryKeys.chat.conversation(projectId, id), {
          ...created,
          messages: optimistic ? [optimistic] : created.messages,
        });

        // The placeholder has been adopted under the real id; leaving it behind
        // is what let it leak into the next conversation.
        queryClient.removeQueries({ queryKey: NEW_CONVERSATION_KEY, exact: true });

        setConversationId(id);
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

      // Written unconditionally, including for the very first question. That
      // case has no conversation yet, so `previous` is undefined and an earlier
      // `if (previous)` guard skipped the write entirely — which is why the
      // first question showed nothing but a spinner until the answer landed.
      // A placeholder conversation stands in until the server returns the real
      // one; it is replaced wholesale in `mutationFn`, never merged.
      queryClient.setQueryData<Conversation>(activeKey, {
        ...(previous ?? {
          id: conversationId ?? 'pending',
          title: question.slice(0, 80),
          scope,
          createdAt: optimistic.createdAt,
          updatedAt: optimistic.createdAt,
          messages: [],
        }),
        messages: [...(previous?.messages ?? []), optimistic],
      });

      pendingMessage.current = optimistic;
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
      if (!context) return;
      // Rolls back against the key `onMutate` wrote to. A first question has no
      // previous state: `onMutate` invented a placeholder conversation, so the
      // undo is to remove the entry rather than restore one. Leaving it would
      // strand a question with no answer and no way to retry it.
      if (context.previous) queryClient.setQueryData(context.key, context.previous);
      else queryClient.removeQueries({ queryKey: context.key, exact: true });
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
