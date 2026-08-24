import {
  type AskResultDto,
  type ChatMessageDto,
  type ChatScopeDto,
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
 * The one piece of real work here is `toCitation`. The backend has never
 * returned a populated `citations` array (RAGFlow is not connected, so every
 * answer is `grounded: false`), so the element shape is unknown. Rather than
 * guess one schema and crash on the first real payload, this reads the field
 * names the backend uses elsewhere for the same concepts, accepts the common
 * aliases, and keeps whatever it recognises.
 *
 * ponytail: alias list, not a parser. Replace with a plain Zod schema the day a
 * real citation is observed — this function is the only thing that has to change.
 */
function pick(source: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asPositiveInt(value: unknown): number | undefined {
  const parsed = typeof value === 'string' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export function toCitation(raw: unknown, fallbackIndex: number): Citation {
  if (typeof raw !== 'object' || raw === null) return { index: fallbackIndex };

  const source = raw as Record<string, unknown>;
  return {
    index: asPositiveInt(pick(source, 'index', 'marker', 'n')) ?? fallbackIndex,
    documentId: asString(pick(source, 'document_id', 'documentId', 'doc_id')),
    documentName: asString(
      pick(source, 'document_name', 'documentName', 'file_name', 'title', 'name')
    ),
    page: asPositiveInt(pick(source, 'page', 'page_number', 'page_no')),
    excerpt: asString(pick(source, 'excerpt', 'content', 'text', 'chunk', 'snippet')),
  };
}

function toCitations(raw: unknown[] | null | undefined): Citation[] {
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
