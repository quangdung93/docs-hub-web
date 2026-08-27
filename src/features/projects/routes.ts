/** Path constants for the projects feature (typed, single source for links). */
export const projectRoutes = {
  list: '/projects',
  create: '/projects/new',
  chat: (projectId: string) => `/projects/${projectId}`,
  documents: (projectId: string) => `/projects/${projectId}/documents`,
  upload: (projectId: string) => `/projects/${projectId}/documents/upload`,
  settings: (projectId: string) => `/projects/${projectId}/settings`,
} as const;
