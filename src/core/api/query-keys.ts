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
  },

  versions: {
    all: ['versions'] as const,
    list: (projectId: string) => ['versions', 'list', projectId] as const,
  },

  chat: {
    history: (projectId: string) => ['chat', 'history', projectId] as const,
  },
} as const;
