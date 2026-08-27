import { delay, http, HttpResponse } from 'msw';

import { db } from '../lib/db';
import { envelope } from '../lib/envelope';

/**
 * Chat endpoints, mirroring the conversation model the real API deployed on
 * 24/08/2026: messages belong to a conversation, and the ask response is a bare
 * answer object (not a message row).
 *
 * The mocked answer always cites the seeded KYC passages so the citation panel,
 * the inline `[n]` markers and the highlight interaction can be exercised
 * without a retrieval backend — which is the one thing the real API cannot do
 * yet, since RAGFlow is not connected and every real answer comes back
 * `grounded: false` with no citations.
 */
const MOCK_CITATIONS = db.chat.p2?.[1]?.citations ?? [];

/** Conversations live only for the process lifetime, like the rest of the mock. */
type MockConversation = {
  id: string;
  project_id: string;
  user_id: string;
  title: string;
  active_scope: { mode: string };
  messages: {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    citations?: unknown[];
    created_at: string;
  }[];
  created_at: string;
  updated_at: string;
};

const conversations = new Map<string, MockConversation>();

export const chatHandlers = [
  http.get('*/projects/:projectId/conversations', ({ params }) => {
    const projectId = String(params.projectId);
    const list = [...conversations.values()].filter((c) => c.project_id === projectId);
    return HttpResponse.json(envelope(list.map(({ messages: _messages, ...rest }) => rest)));
  }),

  http.post('*/projects/:projectId/conversations', async ({ params, request }) => {
    const body = (await request.json().catch(() => ({}))) as {
      title?: string;
      active_scope?: { mode?: string };
    };
    const now = new Date().toISOString();
    const conversation: MockConversation = {
      id: `conv-${conversations.size + 1}`,
      project_id: String(params.projectId),
      user_id: 'mock-user',
      title: body.title ?? '',
      active_scope: { mode: body.active_scope?.mode ?? '' },
      messages: [],
      created_at: now,
      updated_at: now,
    };
    conversations.set(conversation.id, conversation);
    return HttpResponse.json(envelope(conversation), { status: 201 });
  }),

  // `messages` is only included when asked for, exactly as the real API behaves.
  http.get('*/projects/:projectId/conversations/:conversationId', ({ params, request }) => {
    const conversation = conversations.get(String(params.conversationId));
    if (!conversation) return new HttpResponse(null, { status: 404 });

    const wantsMessages = new URL(request.url).searchParams.get('include') === 'messages';
    const { messages, ...rest } = conversation;
    return HttpResponse.json(envelope(wantsMessages ? { ...rest, messages } : rest));
  }),

  http.post(
    '*/projects/:projectId/conversations/:conversationId/messages',
    async ({ params, request }) => {
      const conversation = conversations.get(String(params.conversationId));
      if (!conversation) return new HttpResponse(null, { status: 404 });

      const { question } = (await request.json().catch(() => ({}))) as { question?: string };

      // A visible pause so the "thinking" state and the optimistic user bubble
      // are observable — an instant reply would make both untestable by hand.
      await delay(700);

      const now = new Date().toISOString();
      const answer =
        'Câu trả lời được tổng hợp từ tài liệu của dự án. Quy trình yêu cầu xác thực OTP ở bước định danh[1], và mã có hiệu lực trong 5 phút[2].';

      conversation.messages.push(
        { id: `q-${Date.now()}`, role: 'user', content: question ?? '', created_at: now },
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: answer,
          citations: MOCK_CITATIONS,
          created_at: now,
        }
      );
      conversation.updated_at = now;

      return HttpResponse.json(
        envelope({
          answer,
          intent: 'lookup',
          resolved_scope: [],
          citations: MOCK_CITATIONS,
          grounded: true,
        })
      );
    }
  ),
];
