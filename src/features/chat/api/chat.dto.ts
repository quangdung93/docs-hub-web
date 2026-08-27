import { z } from 'zod';

/**
 * Wire contracts for the conversation-based chat module, probed against
 * api.docshub.io.vn on 24/08/2026. Swagger types every response here as a bare
 * `response.Envelope`, so these shapes come from the running API, not the spec.
 */

/**
 * Retrieval scope. The backend rejects anything else with
 * "Scope chỉ hỗ trợ versions, change_requests hoặc all với danh sách ID phù hợp".
 * Note `versions` is plural — `version` is refused.
 */
export const ScopeModeSchema = z.enum(['all', 'versions', 'change_requests']);

export const ChatScopeDtoSchema = z.object({
  mode: ScopeModeSchema.or(z.literal('')),
  version_ids: z.array(z.string()).nullish(),
  change_request_ids: z.array(z.string()).nullish(),
});

/**
 * One retrieved chunk backing an answer. Observed 25/08/2026, once RAGFlow was
 * connected and answers started coming back `grounded: true`.
 *
 * Two things differ from a typical citation format. The marker is `key` (`"S1"`,
 * `"S2"`), not a number — and the answer text does NOT carry `[1]`-style markers
 * pointing at them, so citations are a source list rather than inline anchors.
 * Line and page bounds exist in the contract but arrive null for every format
 * seen so far, which is why the UI cannot rely on a page number.
 */
export const CitationDtoSchema = z.object({
  key: z.string(),
  chunk_id: z.string().nullish(),
  document_id: z.string().nullish(),
  document_revision_id: z.string().nullish(),
  document_name: z.string().nullish(),
  scope_type: z.string().nullish(),
  scope_label: z.string().nullish(),
  line_start: z.number().nullish(),
  line_end: z.number().nullish(),
  page_start: z.number().nullish(),
  page_end: z.number().nullish(),
  excerpt: z.string().nullish(),
  /** Same-origin path to the source revision — ready for the BFF, no host. */
  source_url: z.string().nullish(),
});

/**
 * A message inside a conversation. Assistant rows carry the extra generation
 * metadata (`intent`, `prompt_version`, `latency_ms`); user rows do not, so all
 * of it is optional.
 */
export const ChatMessageDtoSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  citations: z.array(CitationDtoSchema).nullish(),
  intent: z.string().nullish(),
  prompt_version: z.string().nullish(),
  latency_ms: z.number().nullish(),
  created_at: z.string(),
});

/**
 * `GET /conversations/{id}` only includes `messages` when asked via
 * `?include=messages`; the bare call omits the field entirely.
 */
export const ConversationDtoSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  user_id: z.string(),
  title: z.string(),
  active_scope: ChatScopeDtoSchema.nullish(),
  messages: z.array(ChatMessageDtoSchema).nullish(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const ConversationListDtoSchema = z.array(ConversationDtoSchema);

/**
 * `POST /conversations/{id}/messages` — the answer, not a message row. The
 * persisted pair only appears on the next conversation read.
 *
 * `grounded` is the honest signal: false means the model had nothing from the
 * documents to stand on, so the UI must not present the answer as sourced.
 */
export const AskResultDtoSchema = z.object({
  answer: z.string(),
  intent: z.string().nullish(),
  resolved_scope: z.array(z.unknown()).nullish(),
  citations: z.array(CitationDtoSchema).nullish(),
  grounded: z.boolean().nullish(),
});

export type CitationDto = z.infer<typeof CitationDtoSchema>;
export type ChatScopeDto = z.infer<typeof ChatScopeDtoSchema>;
export type ChatMessageDto = z.infer<typeof ChatMessageDtoSchema>;
export type ConversationDto = z.infer<typeof ConversationDtoSchema>;
export type AskResultDto = z.infer<typeof AskResultDtoSchema>;
export type ScopeMode = z.infer<typeof ScopeModeSchema>;
