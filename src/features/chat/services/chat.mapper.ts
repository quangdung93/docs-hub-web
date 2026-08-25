import {
  type AskResultDto,
  type ChatMessageDto,
  type ChatScopeDto,
  type CitationDto,
  type ConversationDto,
} from '../api/chat.dto';
import {
  type ChatMessage,
  type ChatScope,
  type Citation,
  type Conversation,
  DEFAULT_SCOPE,
} from '../schemas/chat.schema';

/**
 * Wire → domain mapping for chat.
 *
 * The citation shape is no longer guessed: it was confirmed against the live API
 * on 25/08/2026 once RAGFlow was connected, so this reads the real fields
 * directly. `index` is derived from position because the backend keys citations
 * `"S1"`/`"S2"` and puts no matching markers in the answer text.
 */
function trimmed(value: string | null | undefined): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function positiveInt(value: number | null | undefined): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined;
}

export function toCitation(dto: CitationDto, position: number): Citation {
  return {
    index: position,
    key: trimmed(dto.key),
    documentId: trimmed(dto.document_id),
    revisionId: trimmed(dto.document_revision_id),
    documentName: trimmed(dto.document_name),
    scopeLabel: trimmed(dto.scope_label),
    // Only `page_start` is shown: a range needs both ends, and every format seen
    // so far returns null for both.
    page: positiveInt(dto.page_start),
    excerpt: trimmed(dto.excerpt),
    sourceUrl: trimmed(dto.source_url),
  };
}

function toCitations(raw: CitationDto[] | null | undefined): Citation[] {
  return (raw ?? []).map((item, position) => toCitation(item, position + 1));
}

export function toChatScope(dto: ChatScopeDto | null | undefined): ChatScope {
  // A conversation created without an explicit scope comes back with `mode: ""`.
  if (!dto || dto.mode === '') return DEFAULT_SCOPE;
  return {
    mode: dto.mode,
    ...(dto.version_ids ? { versionIds: dto.version_ids } : {}),
    ...(dto.change_request_ids ? { changeRequestIds: dto.change_request_ids } : {}),
  };
}

export function toScopeDto(scope: ChatScope): Record<string, unknown> {
  return {
    mode: scope.mode,
    ...(scope.versionIds ? { version_ids: scope.versionIds } : {}),
    ...(scope.changeRequestIds ? { change_request_ids: scope.changeRequestIds } : {}),
  };
}

export function toChatMessage(dto: ChatMessageDto): ChatMessage {
  return {
    id: dto.id,
    role: dto.role,
    content: dto.content,
    citations: toCitations(dto.citations),
    createdAt: dto.created_at,
  };
}

export function toConversation(dto: ConversationDto): Conversation {
  return {
    id: dto.id,
    title: dto.title,
    scope: toChatScope(dto.active_scope),
    messages: (dto.messages ?? []).map(toChatMessage),
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  };
}

/**
 * The ask response is an answer, not a persisted row — it has no id and no
 * timestamp, so both are synthesised here. The pair is persisted server-side and
 * shows up with real ids on the next conversation read.
 */
export function toAnswerMessage(dto: AskResultDto): ChatMessage {
  return {
    id: `answer-${Date.now()}`,
    role: 'assistant',
    content: dto.answer,
    citations: toCitations(dto.citations),
    ...(dto.grounded === undefined || dto.grounded === null ? {} : { grounded: dto.grounded }),
    createdAt: new Date().toISOString(),
  };
}
