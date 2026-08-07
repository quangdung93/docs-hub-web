/**
 * Single registry of every backend path the app talks to. Feature `api/` modules
 * import from here instead of inlining string literals, so wiring a real backend
 * (or renaming a route) is a one-file change — this is the map you edit when the
 * API lands.
 *
 * Paths are relative to the transport base:
 *  - client (`shared/api/http`) → `/api` + path → BFF proxy → `${API_URL}` + path
 *  - server (`core/api/server-fetch`) → `${API_URL}` + path
 */
export const endpoints = {
  health: '/health',

  auth: {
    login: '/auth/login',
    logout: '/auth/logout',
    refresh: '/auth/refresh',
  },

  projects: {
    list: '/projects',
    create: '/projects',
    detail: (projectId: string) => `/projects/${projectId}`,
    update: (projectId: string) => `/projects/${projectId}`,
    remove: (projectId: string) => `/projects/${projectId}`,
    members: (projectId: string) => `/projects/${projectId}/members`,
    settings: (projectId: string) => `/projects/${projectId}/settings`,
  },

  documents: {
    list: (projectId: string) => `/projects/${projectId}/documents`,
    upload: (projectId: string) => `/projects/${projectId}/documents`,
    remove: (projectId: string, documentId: string) =>
      `/projects/${projectId}/documents/${documentId}`,
    download: (projectId: string, documentId: string) =>
      `/projects/${projectId}/documents/${documentId}/download`,
  },

  chat: {
    ask: (projectId: string) => `/projects/${projectId}/chat`,
    history: (projectId: string) => `/projects/${projectId}/chat/history`,
  },
} as const;
