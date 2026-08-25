/**
 * Self-check for the chat mapper. Run with
 * `npx tsx src/features/chat/services/chat.mapper.test.ts`.
 *
 * The citation case is pinned to a payload copied verbatim from a
 * `grounded: true` answer on 25/08/2026 — the first real one the backend
 * produced, once RAGFlow was connected.
 */
import assert from 'node:assert/strict';

import { toChatScope, toCitation, toConversation, toScopeDto } from './chat.mapper';

// ── Citations ──────────────────────────────────────────────────────────────

// The real payload, copied from a `grounded: true` answer on 25/08/2026.
assert.deepEqual(
  toCitation(
    {
      key: 'S1',
      chunk_id: 'e5447b2ac95f35a4',
      document_id: 'e2d89634-d938-4dd9-93fa-b35676d7cb42',
      document_revision_id: '12152042-91ad-4866-a162-f1e70ab26c8f',
      document_name: 'docx_sach.docx',
      scope_type: 'version',
      scope_label: 'v1.0.0',
      line_start: null,
      line_end: null,
      page_start: null,
      page_end: null,
      excerpt: 'Quy trinh kiem thu DOCX',
      source_url: '/internal/api/v1/projects/p/documents/d/revisions/r/view',
    },
    1
  ),
  {
    index: 1,
    key: 'S1',
    documentId: 'e2d89634-d938-4dd9-93fa-b35676d7cb42',
    revisionId: '12152042-91ad-4866-a162-f1e70ab26c8f',
    documentName: 'docx_sach.docx',
    scopeLabel: 'v1.0.0',
    page: undefined,
    excerpt: 'Quy trinh kiem thu DOCX',
    sourceUrl: '/internal/api/v1/projects/p/documents/d/revisions/r/view',
  }
);

// `index` comes from position — the backend key is "S1", not a number, and the
// answer text carries no matching marker to line up with.
assert.equal(toCitation({ key: 'S3' }, 3).index, 3);

// Null bounds (every format observed so far) must not become a page 0.
assert.equal(toCitation({ key: 'S1', page_start: null }, 1).page, undefined);
assert.equal(toCitation({ key: 'S1', page_start: 0 }, 1).page, undefined);
assert.equal(toCitation({ key: 'S1', page_start: 4 }, 1).page, 4);

// Empty and whitespace-only strings are absent, not empty labels.
assert.equal(toCitation({ key: 'S1', document_name: '' }, 1).documentName, undefined);
assert.equal(toCitation({ key: 'S1', excerpt: '   ' }, 1).excerpt, undefined);

// ── Scope ───────────────────────────────────────────────────────────────────

// A conversation created without a scope comes back `mode: ''` → default to all.
assert.deepEqual(toChatScope({ mode: '' }), { mode: 'all' });
assert.deepEqual(toChatScope(null), { mode: 'all' });
assert.deepEqual(toChatScope(undefined), { mode: 'all' });

assert.deepEqual(toChatScope({ mode: 'versions', version_ids: ['v1'] }), {
  mode: 'versions',
  versionIds: ['v1'],
});

// Round-trips back to the wire spelling the backend validates against.
assert.deepEqual(toScopeDto({ mode: 'versions', versionIds: ['v1'] }), {
  mode: 'versions',
  version_ids: ['v1'],
});
assert.deepEqual(toScopeDto({ mode: 'all' }), { mode: 'all' });

// ── Conversation ────────────────────────────────────────────────────────────

// `messages` is absent unless `?include=messages` was sent — must not blow up.
assert.deepEqual(
  toConversation({
    id: 'c1',
    project_id: 'p1',
    user_id: 'u1',
    title: 'Hỏi về KYC',
    active_scope: { mode: 'all' },
    created_at: '2026-08-24T10:00:00Z',
    updated_at: '2026-08-24T10:00:00Z',
  }).messages,
  []
);

const withMessages = toConversation({
  id: 'c1',
  project_id: 'p1',
  user_id: 'u1',
  title: 't',
  active_scope: { mode: 'all' },
  messages: [
    { id: 'm1', role: 'user', content: 'hỏi', created_at: '2026-08-24T10:00:00Z' },
    {
      id: 'm2',
      role: 'assistant',
      content: 'đáp',
      intent: 'evolution',
      latency_ms: 3,
      created_at: '2026-08-24T10:00:01Z',
    },
  ],
  created_at: '2026-08-24T10:00:00Z',
  updated_at: '2026-08-24T10:00:01Z',
});
assert.equal(withMessages.messages.length, 2);
assert.equal(withMessages.messages[1]?.role, 'assistant');
assert.deepEqual(withMessages.messages[1]?.citations, []);

// The backend emits each turn as [assistant, user] with an identical timestamp
// on both rows, so the transcript reads answer-before-question until reordered.
// Observed 25/08/2026 over a 10-message conversation.
const reordered = toConversation({
  id: 'c2',
  project_id: 'p1',
  user_id: 'u1',
  title: 't',
  active_scope: { mode: 'all' },
  messages: [
    { id: 'a1', role: 'assistant', content: 'dap 1', created_at: '2026-08-25T09:25:11Z' },
    { id: 'q1', role: 'user', content: 'hoi 1', created_at: '2026-08-25T09:25:11Z' },
    { id: 'a2', role: 'assistant', content: 'dap 2', created_at: '2026-08-25T09:25:18Z' },
    { id: 'q2', role: 'user', content: 'hoi 2', created_at: '2026-08-25T09:25:18Z' },
  ],
  created_at: '2026-08-25T09:25:11Z',
  updated_at: '2026-08-25T09:25:18Z',
}).messages;
assert.deepEqual(
  reordered.map((m) => m.content),
  ['hoi 1', 'dap 1', 'hoi 2', 'dap 2']
);

// A pair that is already in order must be left alone.
const alreadyRight = toConversation({
  id: 'c3',
  project_id: 'p1',
  user_id: 'u1',
  title: 't',
  active_scope: { mode: 'all' },
  messages: [
    { id: 'q', role: 'user', content: 'hoi', created_at: '2026-08-25T09:00:00Z' },
    { id: 'a', role: 'assistant', content: 'dap', created_at: '2026-08-25T09:00:00Z' },
  ],
  created_at: '2026-08-25T09:00:00Z',
  updated_at: '2026-08-25T09:00:00Z',
}).messages;
assert.deepEqual(
  alreadyRight.map((m) => m.content),
  ['hoi', 'dap']
);

// Different timestamps are the backend's own ordering — do not touch them.
const distinctTimes = toConversation({
  id: 'c4',
  project_id: 'p1',
  user_id: 'u1',
  title: 't',
  active_scope: { mode: 'all' },
  messages: [
    { id: 'a', role: 'assistant', content: 'dap', created_at: '2026-08-25T09:00:01Z' },
    { id: 'q', role: 'user', content: 'hoi', created_at: '2026-08-25T09:00:02Z' },
  ],
  created_at: '2026-08-25T09:00:01Z',
  updated_at: '2026-08-25T09:00:02Z',
}).messages;
assert.deepEqual(
  distinctTimes.map((m) => m.content),
  ['dap', 'hoi']
);

console.log('chat.mapper: all assertions passed');
