import { apiSuccessSchema, endpoints } from '@/core/api';
import { http } from '@/shared/api/http';

import { type ChatMessage, type ChatScope, type Conversation } from '../schemas/chat.schema';
import { toAnswerMessage, toConversation, toScopeDto } from '../services/chat.mapper';
import { AskResultDtoSchema, ConversationDtoSchema, ConversationListDtoSchema } from './chat.dto';

/**
 * Chat transport, pointed at the real conversation API since 24/08/2026.
 *
 * The model differs from the old mock in one way that reaches the UI: messages
 * belong to a **conversation**, not to a project, so asking a question requires
 * creating or resuming one first. `useChat` handles that.
 *
 * Not wired: `POST /search` (retrieval without the chat layer). It answers
 * `DB_500 "Không thể đọc RAGFlow dataset mapping"` for every valid scope, and
 * nothing in the UI needs raw chunks yet. `endpoints.chat.search` records it.
 */
export const chatApi = {
  /** Conversations in a project, newest first per the backend's own ordering. */
  list: async (projectId: string, signal?: AbortSignal): Promise<Conversation[]> => {
    const { data } = await http.get(endpoints.chat.conversations(projectId), { signal });
    return apiSuccessSchema(ConversationListDtoSchema).parse(data).data.map(toConversation);
  },

  /**
   * One conversation with its messages. `include=messages` is required — the
   * bare call omits the field entirely rather than returning an empty array.
   */
  detail: async (
    projectId: string,
    conversationId: string,
    signal?: AbortSignal
  ): Promise<Conversation> => {
    const { data } = await http.get(endpoints.chat.conversation(projectId, conversationId), {
      params: { include: 'messages' },
      signal,
    });
    return toConversation(apiSuccessSchema(ConversationDtoSchema).parse(data).data);
  },

  create: async (projectId: string, title: string, scope: ChatScope): Promise<Conversation> => {
    const { data } = await http.post(endpoints.chat.conversations(projectId), {
      title,
      active_scope: toScopeDto(scope),
    });
    return toConversation(apiSuccessSchema(ConversationDtoSchema).parse(data).data);
  },

  /**
   * Ask inside a conversation. Returns the answer alone — the backend persists
   * both the question and the answer, which surface with real ids on the next
   * `detail()` read.
   */
  ask: async (
    projectId: string,
    conversationId: string,
    question: string
  ): Promise<ChatMessage> => {
    const { data } = await http.post(endpoints.chat.ask(projectId, conversationId), { question });
    return toAnswerMessage(apiSuccessSchema(AskResultDtoSchema).parse(data).data);
  },
};
