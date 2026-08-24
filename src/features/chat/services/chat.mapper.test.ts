/**
 * Self-check for the chat mapper. Run with
 * `npx tsx src/features/chat/services/chat.mapper.test.ts`.
 *
 * The interesting case is `toCitation`: the backend has never returned a
 * populated citation, so it accepts several plausible field spellings. These
 * assertions pin that behaviour down — when a real citation is finally observed,
 * a failure here says the guess was wrong.
 */
import assert from 'node:assert/strict';

import { toChatScope, toCitation, toConversation, toScopeDto } from './chat.mapper';

// ── Citations ───────────────────────────────────────────────────────────────

// snake_case, the spelling the rest of this API uses.
assert.deepEqual(
  toCitation(
    { index: 2, document_id: 'doc-1', document_name: 'KYC.pdf', page: 4, excerpt: 'text' },
    99
  ),
  { index: 2, documentId: 'doc-1', documentName: 'KYC.pdf', page: 4, excerpt: 'text' }
);

// camelCase and the alternative names are accepted too.
assert.deepEqual(toCitation({ documentId: 'd', title: 'A.pdf', page_number: 7, content: 'x' }, 1), {
  index: 1,
  documentId: 'd',
  documentName: 'A.pdf',
  page: 7,
  excerpt: 'x',
});

// Missing index falls back to position, so markers still line up 1..n.
assert.equal(toCitation({ excerpt: 'x' }, 3).index, 3);

// Garbage never throws — a citation that cannot be read still renders its marker.
assert.deepEqual(toCitation(null, 1), { index: 1 });
assert.deepEqual(toCitation('nonsense', 5), { index: 5 });

// A page of 0 or a negative page is not a page.
assert.equal(toCitation({ page: 0 }, 1).page, undefined);
assert.equal(toCitation({ page: -2 }, 1).page, undefined);
// …but a numeric string is.
assert.equal(toCitation({ page: '12' }, 1).page, 12);

// Empty strings are absent, not empty labels.
assert.equal(toCitation({ document_name: '' }, 1).documentName, undefined);

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

console.log('chat.mapper: all assertions passed');
