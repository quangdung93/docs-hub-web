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

  // ── In Swagger but NOT routed on the deployed build ──────────────────────
  // The chat module appeared in Swagger on 22/08/2026, but every one of these
  // answers a bare `404 page not found` on api.docshub.io.vn — the running
  // binary is older than the published spec. Paths are recorded here so the
  // switch is one file; the chat slice stays on MSW until the backend deploys.
  //
  // Two things the spec does not say and the backend must confirm before this
  // can be wired for real: the allowed values of `scope.mode`, and the response
  // shapes (Swagger types every response as a bare `response.Envelope`).
  chat: {
    // ── Provisional paths, still served by MSW ──────────────────────────────
    // The chat UI runs on these until the conversation endpoints below are
    // actually deployed. They exist only in the mock.
    history: (projectId: string) => `/projects/${projectId}/chat/history`,
    askLegacy: (projectId: string) => `/projects/${projectId}/chat`,

    /** Conversations own the message history; a project can have several. */
    conversations: (projectId: string) => `${INTERNAL}/projects/${projectId}/conversations`,
    conversation: (projectId: string, conversationId: string) =>
      `${INTERNAL}/projects/${projectId}/conversations/${conversationId}`,
    /** Ask a question inside a conversation; answers carry citations. */
    ask: (projectId: string, conversationId: string) =>
      `${INTERNAL}/projects/${projectId}/conversations/${conversationId}/messages`,
    /**
     * Retrieval without the chat layer — returns matching chunks, no answer.
     * Replaced `/retrieval`, and renamed its field `question` → `query` with a
     * now-REQUIRED `scope`.
     */
    search: (projectId: string) => `${INTERNAL}/projects/${projectId}/search`,
  },
} as const;
