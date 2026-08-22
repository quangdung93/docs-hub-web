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
    refresh: `${PUBLIC}/auth/refresh`,
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
    detail: (projectId: string) => `${INTERNAL}/projects/${projectId}`,
    update: (projectId: string) => `${INTERNAL}/projects/${projectId}`,
    remove: (projectId: string) => `${INTERNAL}/projects/${projectId}`,
    avatarUploadUrl: (projectId: string) => `${INTERNAL}/projects/${projectId}/avatar/upload-url`,
    avatarComplete: (projectId: string) => `${INTERNAL}/projects/${projectId}/avatar/complete`,
    members: (projectId: string) => `${INTERNAL}/projects/${projectId}/members`,
    acceptInvite: (projectId: string) => `${INTERNAL}/projects/${projectId}/members/me/accept`,
    member: (projectId: string, userId: string) =>
      `${INTERNAL}/projects/${projectId}/members/${userId}`,
  },

  versions: {
    list: (projectId: string) => `${INTERNAL}/projects/${projectId}/versions`,
    create: (projectId: string) => `${INTERNAL}/projects/${projectId}/versions`,
  },

  documents: {
    list: (projectId: string) => `${INTERNAL}/projects/${projectId}/documents`,
    detail: (projectId: string, documentId: string) =>
      `${INTERNAL}/projects/${projectId}/documents/${documentId}`,
    update: (projectId: string, documentId: string) =>
      `${INTERNAL}/projects/${projectId}/documents/${documentId}`,
    remove: (projectId: string, documentId: string) =>
      `${INTERNAL}/projects/${projectId}/documents/${documentId}`,
    /** Multipart upload of a brand-new document (first revision). */
    upload: (projectId: string) => `${INTERNAL}/projects/${projectId}/documents/uploads`,
    /** Multipart upload of a further revision of an existing document. */
    uploadRevision: (projectId: string, documentId: string) =>
      `${INTERNAL}/projects/${projectId}/documents/${documentId}/revisions`,
    /** Presigned direct-to-storage upload; only when the backend runs MinIO. */
    presign: (projectId: string) => `${INTERNAL}/projects/${projectId}/documents/uploads/presign`,
    completeUpload: (projectId: string, uploadId: string) =>
      `${INTERNAL}/projects/${projectId}/documents/uploads/${uploadId}/complete`,
    revisionStatus: (projectId: string, documentId: string, revisionId: string) =>
      `${INTERNAL}/projects/${projectId}/documents/${documentId}/revisions/${revisionId}/status`,
    revisionRetry: (projectId: string, documentId: string, revisionId: string) =>
      `${INTERNAL}/projects/${projectId}/documents/${documentId}/revisions/${revisionId}/retry`,
    revisionDownload: (projectId: string, documentId: string, revisionId: string) =>
      `${INTERNAL}/projects/${projectId}/documents/${documentId}/revisions/${revisionId}/download`,
    revisionView: (projectId: string, documentId: string, revisionId: string) =>
      `${INTERNAL}/projects/${projectId}/documents/${documentId}/revisions/${revisionId}/view`,
  },

  // ── In Swagger but NOT routed on the deployed build ───────────────────────
  // `POST /projects/{id}/retrieval` is documented but answers a bare 404 (not
  // even an error envelope), verified 21/08/2026. The path is kept here so the
  // chat slice has one place to switch to; until the backend deploys it, chat
  // still runs on the MSW mock.
  retrieval: (projectId: string) => `${INTERNAL}/projects/${projectId}/retrieval`,

  chat: {
    ask: (projectId: string) => `/projects/${projectId}/chat`,
    history: (projectId: string) => `/projects/${projectId}/chat/history`,
  },
} as const;
