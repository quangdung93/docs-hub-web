import { z } from 'zod';

/**
 * Chat contracts. A citation is a first-class object (not a marker parsed out of
 * the answer text) so the UI can render the source panel, the inline `[n]`
 * buttons and the source chips from one structure.
 */
export const CitationSchema = z.object({
  /** 1-based marker as it appears in the answer text. */
  index: z.number().int().positive(),
  documentId: z.string(),
  documentName: z.string(),
  page: z.number().int().positive(),
  excerpt: z.string(),
});

export const ChatMessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  citations: z.array(CitationSchema).default([]),
  createdAt: z.iso.datetime(),
});

export const ChatMessageListSchema = z.array(ChatMessageSchema);

export const AskInputSchema = z.object({
  question: z.string().trim().min(1),
});

export type Citation = z.infer<typeof CitationSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type AskInput = z.infer<typeof AskInputSchema>;
