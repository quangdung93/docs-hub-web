import { apiSuccessSchema, endpoints } from '@/core/api';
import { http } from '@/shared/api/http';

import { type ChatMessage, ChatMessageListSchema, ChatMessageSchema } from '../schemas/chat.schema';

/**
 * Chat transport. `ask` is a plain request/response today; when the backend
 * exposes token streaming this is the only file that changes — the hook already
 * treats the answer as arriving after the question is optimistically rendered.
 */
export const chatApi = {
  history: async (projectId: string, signal?: AbortSignal): Promise<ChatMessage[]> => {
    const { data } = await http.get(endpoints.chat.history(projectId), { signal });
    return apiSuccessSchema(ChatMessageListSchema).parse(data).data;
  },

  ask: async (projectId: string, question: string): Promise<ChatMessage> => {
    const { data } = await http.post(endpoints.chat.ask(projectId), { question });
    return apiSuccessSchema(ChatMessageSchema).parse(data).data;
  },
};
