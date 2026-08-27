import { z } from 'zod';

/**
 * A source backing an answer. Shape confirmed against the live API on
 * 25/08/2026, once RAGFlow was connected.
 *
 * `index` is derived from position, not sent: the backend keys citations `"S1"`,
 * `"S2"` and does NOT put matching markers in the answer text, so these are a
 * source list rather than inline anchors. `page` is optional because the backend
 * returns null bounds for every format observed so far.
 */
export const CitationSchema = z.object({
  /** 1-based position, used for the visible marker. */
  index: z.number().int().positive(),
  /** Backend key (`"S1"`), kept so a citation can be traced back to its chunk. */
  key: z.string().optional(),
  documentId: z.string().optional(),
  revisionId: z.string().optional(),
  documentName: z.string().optional(),
  /** Which version/change request the chunk came from, e.g. `"v1.0.0"`. */
  scopeLabel: z.string().optional(),
  page: z.number().int().positive().optional(),
  excerpt: z.string().optional(),
  /** Same-origin path to view the source revision. */
  sourceUrl: z.string().optional(),
});

export const ChatMessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  citations: z.array(CitationSchema).default([]),
  /**
   * False when the answer is not backed by retrieved documents. Undefined on
   * user messages and on history rows, which do not carry the flag.
   */
  grounded: z.boolean().optional(),
  createdAt: z.iso.datetime(),
});

export const ChatMessageListSchema = z.array(ChatMessageSchema);

/** Which documents a question is answered from. */
export const ChatScopeSchema = z.object({
  mode: z.enum(['all', 'versions', 'change_requests']),
  versionIds: z.array(z.string()).optional(),
  changeRequestIds: z.array(z.string()).optional(),
});

export const ConversationSchema = z.object({
  id: z.string(),
  title: z.string(),
  scope: ChatScopeSchema,
  messages: z.array(ChatMessageSchema).default([]),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const ConversationListSchema = z.array(ConversationSchema);

export const AskInputSchema = z.object({
  question: z.string().trim().min(1),
});

export type Citation = z.infer<typeof CitationSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type ChatScope = z.infer<typeof ChatScopeSchema>;
export type Conversation = z.infer<typeof ConversationSchema>;
export type AskInput = z.infer<typeof AskInputSchema>;

/** Default scope for a new conversation: every document in the project. */
export const DEFAULT_SCOPE: ChatScope = { mode: 'all' };
