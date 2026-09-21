/** Path constants for the projects feature (typed, single source for links). */
export const projectRoutes = {
  list: '/projects',
  create: '/projects/new',
  chat: (projectId: string) => `/projects/${projectId}`,
  /**
   * Danh sách tài liệu. `versionId` để màn hình mở đúng phiên bản vừa làm việc
   * thay vì rơi về bản mới nhất — lựa chọn phiên bản ở màn upload là state cục
   * bộ, đi khỏi trang là mất.
   */
  documents: (projectId: string, versionId?: string) =>
    versionId
      ? `/projects/${projectId}/documents?version=${encodeURIComponent(versionId)}`
      : `/projects/${projectId}/documents`,
  upload: (projectId: string) => `/projects/${projectId}/documents/upload`,
  settings: (projectId: string) => `/projects/${projectId}/settings`,
} as const;
