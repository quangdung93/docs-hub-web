/**
 * Self-check for the optimistic-cache dance in `useChat`. Run with
 * `npx tsx src/features/chat/hooks/use-chat.test.ts`.
 *
 * This is the one place in the app where a cache key changes *during* a
 * mutation: the first question has no conversation, so `onMutate` writes under
 * the "none" key and `mutationFn` then creates the real one. Getting that wrong
 * makes the first question vanish — a regression this file exists to prevent,
 * having shipped twice already.
 *
 * The React hook is not exercised; the cache transitions are. They are the part
 * that broke both times, and they are testable without a renderer.
 */
import assert from 'node:assert/strict';
import { QueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/core/api';
import type { ChatMessage, Conversation } from '../schemas/chat.schema';

const PROJECT = 'p1';
const SCOPE = { mode: 'all' as const };
const NONE = queryKeys.chat.conversation(PROJECT, 'none');

const optimisticOf = (question: string): ChatMessage => ({
  id: 'optimistic-1',
  role: 'user',
  content: question,
  citations: [],
  createdAt: '2026-09-03T00:00:00.000Z',
});

const answerOf = (): ChatMessage => ({
  id: 'a1',
  role: 'assistant',
  content: 'Câu trả lời.',
  citations: [],
  createdAt: '2026-09-03T00:00:02.000Z',
});

/** Mirrors `onMutate`: the write must happen whether or not a conversation exists. */
function writeOptimistic(client: QueryClient, key: readonly unknown[], question: string) {
  const previous = client.getQueryData<Conversation>(key);
  const optimistic = optimisticOf(question);
  client.setQueryData<Conversation>(key, {
    ...(previous ?? {
      id: 'pending',
      title: question.slice(0, 80),
      scope: SCOPE,
      createdAt: optimistic.createdAt,
      updatedAt: optimistic.createdAt,
      messages: [],
    }),
    messages: [...(previous?.messages ?? []), optimistic],
  });
  return { previous, optimistic };
}

/**
 * Mirrors the id-swap in `mutationFn`: the bubble is taken from the mutation's
 * own context, not read back out of the shared "none" slot, and that slot is
 * cleared once adopted.
 */
function adoptServerConversation(
  client: QueryClient,
  fromKey: readonly unknown[],
  id: string,
  optimistic: ChatMessage
) {
  const created: Conversation = {
    id,
    title: 'Câu hỏi đầu tiên',
    scope: SCOPE,
    messages: [],
    createdAt: '2026-09-03T00:00:01.000Z',
    updatedAt: '2026-09-03T00:00:01.000Z',
  };
  client.setQueryData<Conversation>(queryKeys.chat.conversation(PROJECT, id), {
    ...created,
    messages: [optimistic],
  });
  client.removeQueries({ queryKey: fromKey, exact: true });
}

// ── The reported bug: the first question must be visible while it is pending ──
{
  const client = new QueryClient();
  writeOptimistic(client, NONE, 'quy tắc nghiệp vụ login là gì?');

  const cached = client.getQueryData<Conversation>(NONE);
  assert.ok(cached, 'the first question must write a conversation, not skip it');
  assert.equal(cached.messages.length, 1, 'the question bubble must exist while pending');
  assert.equal(cached.messages[0]!.content, 'quy tắc nghiệp vụ login là gì?');
  assert.equal(cached.messages[0]!.role, 'user');
}

// ── ...and must survive the key changing under it when the id arrives ────────
{
  const client = new QueryClient();
  const first = writeOptimistic(client, NONE, 'câu hỏi đầu');
  adoptServerConversation(client, NONE, 'conv-1', first.optimistic);

  const moved = client.getQueryData<Conversation>(queryKeys.chat.conversation(PROJECT, 'conv-1'));
  assert.ok(moved, 'the real key must hold the conversation');
  assert.equal(
    moved.messages.length,
    1,
    'the question must survive the id swap — the server conversation is empty'
  );
  assert.equal(moved.messages[0]!.content, 'câu hỏi đầu');
  assert.equal(moved.id, 'conv-1', 'the server id replaces the placeholder');
}

// ── onSuccess appends the answer without duplicating the question ────────────
{
  const client = new QueryClient();
  const { optimistic } = writeOptimistic(client, NONE, 'câu hỏi đầu');
  adoptServerConversation(client, NONE, 'conv-1', optimistic);

  const key = queryKeys.chat.conversation(PROJECT, 'conv-1');
  client.setQueryData<Conversation>(key, (current) => {
    if (!current) return current;
    const hasOptimistic = current.messages.some((m) => m.id === optimistic.id);
    const base = hasOptimistic ? current.messages : [...current.messages, optimistic];
    return { ...current, messages: [...base, answerOf()] };
  });

  const done = client.getQueryData<Conversation>(key)!;
  assert.equal(done.messages.length, 2, 'question + answer, not three rows');
  assert.deepEqual(
    done.messages.map((m) => m.role),
    ['user', 'assistant'],
    'the question stays first'
  );
}

// ── A second question appends rather than replacing the transcript ───────────
{
  const client = new QueryClient();
  const key = queryKeys.chat.conversation(PROJECT, 'conv-1');
  client.setQueryData<Conversation>(key, {
    id: 'conv-1',
    title: 't',
    scope: SCOPE,
    messages: [optimisticOf('câu 1'), answerOf()],
    createdAt: '2026-09-03T00:00:00.000Z',
    updatedAt: '2026-09-03T00:00:00.000Z',
  });

  writeOptimistic(client, key, 'câu 2');
  const after = client.getQueryData<Conversation>(key)!;
  assert.equal(after.messages.length, 3, 'the existing transcript is kept');
  assert.equal(after.messages[2]!.content, 'câu 2');
}

// ── A failed first question must not strand a placeholder in the cache ──────
{
  const client = new QueryClient();
  const { previous } = writeOptimistic(client, NONE, 'câu hỏi hỏng');
  assert.equal(previous, undefined, 'a first question has nothing to restore');

  // Mirrors `onError`: with no previous state the undo is removal, not restore.
  if (previous) client.setQueryData(NONE, previous);
  else client.removeQueries({ queryKey: NONE, exact: true });

  assert.equal(
    client.getQueryData<Conversation>(NONE),
    undefined,
    'a failed first question leaves no orphan conversation behind'
  );
}

// ── Two new conversations in a row must not share the "none" slot ───────────
// Regression: the placeholder key is reused by every new conversation, so
// reading it wholesale carried the previous question into the next transcript.
{
  const client = new QueryClient();

  const a = writeOptimistic(client, NONE, 'câu hỏi A');
  adoptServerConversation(client, NONE, 'conv-a', a.optimistic);

  assert.equal(
    client.getQueryData<Conversation>(NONE),
    undefined,
    'the placeholder must be cleared once adopted'
  );

  // A second "new conversation" in the same session.
  const b = writeOptimistic(client, NONE, 'câu hỏi B');
  adoptServerConversation(client, NONE, 'conv-b', b.optimistic);

  const convB = client.getQueryData<Conversation>(queryKeys.chat.conversation(PROJECT, 'conv-b'))!;
  assert.equal(convB.messages.length, 1, 'the second conversation holds only its own question');
  assert.equal(convB.messages[0]!.content, 'câu hỏi B');

  const convA = client.getQueryData<Conversation>(queryKeys.chat.conversation(PROJECT, 'conv-a'))!;
  assert.equal(convA.messages[0]!.content, 'câu hỏi A', 'the first conversation is untouched');
}

console.log('use-chat: all assertions passed');
