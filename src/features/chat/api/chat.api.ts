import { apiSuccessSchema, endpoints } from '@/core/api';
import { http } from '@/shared/api/http';

import { type ChatMessage, ChatMessageListSchema, ChatMessageSchema } from '../schemas/chat.schema';

/**
 * Chat transport.
 *
 * Still pointed at the MSW mock. docs-hub-api published a conversation-based
 * chat module on 22/08/2026 (`/conversations`, `/conversations/{id}/messages`,
 * `/search`), but every one of those answers 404 on the deployed build, and
 * Swagger types their responses as a bare envelope — so the real shapes are
 * unknown. Wiring them now would be guesswork; `endpoints.chat` records the
 * paths so the switch is contained to this file once the backend deploys.
 *
 * The real model differs in one way that will reach the UI: messages belong to a
 * **conversation**, not directly to a project, so asking a question first
 * requires creating (or resuming) one.
 */
export const chatApi = {
  history: async (projectId: string, signal?: AbortSignal): Promise<ChatMessage[]> => {
    const { data } = await http.get(endpoints.chat.history(projectId), { signal });
    return apiSuccessSchema(ChatMessageListSchema).parse(data).data;
  },

  ask: async (projectId: string, question: string): Promise<ChatMessage> => {
    const { data } = await http.post(endpoints.chat.askLegacy(projectId), { question });
    return apiSuccessSchema(ChatMessageSchema).parse(data).data;
  },
};
