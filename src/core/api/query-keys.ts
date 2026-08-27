/**
 * Central TanStack Query key factory. Keys live here (not scattered in hooks) so
 * invalidation from one slice can safely target another — e.g. uploading a
 * document invalidates both the document list and the project detail counters.
 */
export const queryKeys = {
  health: ['health'] as const,

  projects: {
    all: ['projects'] as const,
    list: () => ['projects', 'list'] as const,
    detail: (projectId: string) => ['projects', 'detail', projectId] as const,
    members: (projectId: string) => ['projects', 'members', projectId] as const,
    settings: (projectId: string) => ['projects', 'settings', projectId] as const,
  },

  documents: {
    all: ['documents'] as const,
    list: (projectId: string, filters?: object) =>
      ['documents', 'list', projectId, filters ?? {}] as const,
    detail: (projectId: string, documentId: string) =>
      ['documents', 'detail', projectId, documentId] as const,
    /** Ingestion pipeline of one revision — polled while it is still running. */
    revisionStatus: (projectId: string, documentId: string, revisionId: string) =>
      ['documents', 'revision-status', projectId, documentId, revisionId] as const,
  },

  versions: {
    all: ['versions'] as const,
    list: (projectId: string) => ['versions', 'list', projectId] as const,
  },

  chat: {
    /** Conversations in a project. */
    conversations: (projectId: string) => ['chat', 'conversations', projectId] as const,
    /** One conversation with its messages — the chat screen's source of truth. */
    conversation: (projectId: string, conversationId: string) =>
      ['chat', 'conversation', projectId, conversationId] as const,
  },
} as const;
