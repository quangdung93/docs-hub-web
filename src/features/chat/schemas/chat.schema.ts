import { z } from 'zod';

/**
 * Chat contracts. A citation is a first-class object (not a marker parsed out of
 * the answer text) so the UI can render the source panel, the inline `[n]`
 * buttons and the source chips from one structure.
 *
 * Every field except `index` is optional: the backend has never returned a
 * populated citation (RAGFlow is not connected, so answers come back
 * `grounded: false`), and the real element shape is still unknown. The mapper
 * fills what it recognises and the UI degrades to what it has.
 */
export const CitationSchema = z.object({
  /** 1-based marker as it appears in the answer text. */
  index: z.number().int().positive(),
  documentId: z.string().optional(),
  documentName: z.string().optional(),
  page: z.number().int().positive().optional(),
  excerpt: z.string().optional(),
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
