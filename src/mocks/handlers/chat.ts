import { delay, http, HttpResponse } from 'msw';

import { ChatMessageListSchema, ChatMessageSchema } from '../../features/chat/schemas/chat.schema';
import { db } from '../lib/db';
import { envelope } from '../lib/envelope';

/**
 * Chat endpoints. The mocked answer always cites the seeded KYC passages so the
 * citation panel, the inline `[n]` markers and the highlight interaction can all
 * be exercised without a real retrieval backend.
 */
const MOCK_CITATIONS = db.chat.p2?.[1]?.citations ?? [];

export const chatHandlers = [
  http.get('*/projects/:projectId/chat/history', ({ params }) => {
    const history = db.chat[String(params.projectId)] ?? [];
    return HttpResponse.json(envelope(ChatMessageListSchema.parse(history)));
  }),

  http.post('*/projects/:projectId/chat', async ({ params, request }) => {
    const projectId = String(params.projectId);
    const { question } = (await request.json().catch(() => ({}))) as { question?: string };

    // A visible pause so the "thinking" state and the optimistic user bubble are
    // observable — an instant reply would make both untestable by hand.
    await delay(700);

    const history = (db.chat[projectId] ??= []);

    history.push(
      ChatMessageSchema.parse({
        id: `q-${Date.now()}`,
        role: 'user',
        content: question ?? '',
        citations: [],
        createdAt: new Date().toISOString(),
      })
    );

    const answer = ChatMessageSchema.parse({
      id: `a-${Date.now()}`,
      role: 'assistant',
      content:
        'Câu trả lời được tổng hợp từ tài liệu của dự án. Quy trình yêu cầu xác thực OTP ở bước định danh[1], và mã có hiệu lực trong 5 phút[2].',
      citations: MOCK_CITATIONS,
      createdAt: new Date().toISOString(),
    });

    history.push(answer);
    return HttpResponse.json(envelope(answer));
  }),
];
