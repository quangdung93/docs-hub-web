/**
 * Single registry of every backend path the app talks to. Feature `api/` modules
 * import from here instead of inlining string literals, so a route rename is a
 * one-file change.
 *
 * Paths mirror docs-hub-api and keep its two prefixes:
 *  - `/public/api/v1/*`   — no token required
 *  - `/internal/api/v1/*` — `Authorization: Bearer <token>` required
 *
 * They are relative to the transport base:
 *  - client (`shared/api/http`) → `/api` + path → BFF proxy → `${API_URL}` + path
 *  - server (`core/api/server-fetch`) → `${API_URL}` + path
 */
const PUBLIC = '/public/api/v1';
const INTERNAL = '/internal/api/v1';

export const endpoints = {
  health: '/health',

  auth: {
    login: `${PUBLIC}/auth/login`,
    logout: `${INTERNAL}/auth/logout`,
    me: `${INTERNAL}/auth/me`,
  },

  users: {
    list: `${INTERNAL}/users`,
    create: `${INTERNAL}/users`,
    checkEmail: `${INTERNAL}/users/check-email`,
    detail: (userId: string) => `${INTERNAL}/users/${userId}`,
    update: (userId: string) => `${INTERNAL}/users/${userId}`,
    updateStatus: (userId: string) => `${INTERNAL}/users/${userId}/status`,
    remove: (userId: string) => `${INTERNAL}/users/${userId}`,
  },

  projects: {
    list: `${INTERNAL}/projects`,
    create: `${INTERNAL}/projects`,
    update: (projectId: string) => `${INTERNAL}/projects/${projectId}`,
    remove: (projectId: string) => `${INTERNAL}/projects/${projectId}`,
    avatarUploadUrl: (projectId: string) => `${INTERNAL}/projects/${projectId}/avatar/upload-url`,
    avatarComplete: (projectId: string) => `${INTERNAL}/projects/${projectId}/avatar/complete`,
    members: (projectId: string) => `${INTERNAL}/projects/${projectId}/members`,
    acceptInvite: (projectId: string) => `${INTERNAL}/projects/${projectId}/members/me/accept`,
    member: (projectId: string, userId: string) =>
      `${INTERNAL}/projects/${projectId}/members/${userId}`,
  },

  // ── Not implemented by the backend yet ────────────────────────────────────
  // The documents and chat modules do not exist in docs-hub-api. These paths are
  // provisional and still served by the MSW mock; confirm them with the backend
  // team before wiring the real thing.
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
