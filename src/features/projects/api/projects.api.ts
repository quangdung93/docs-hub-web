import { AppError, endpoints, unwrap, unwrapPaginated, type Paginated } from '@/core/api';
import { http } from '@/shared/api/http';

import { toProject, toProjectMember, toProjectSettings } from '../services/project.mapper';
import type {
  CreateProjectInput,
  Project,
  ProjectMember,
  ProjectSettings,
  UpdateProjectInput,
} from '../schemas/project.schema';

import { AvatarUploadUrlDtoSchema, ProjectDtoSchema, ProjectMemberDtoSchema } from './project.dto';

/** Label of the version every new project starts with. */
export const FIRST_VERSION_LABEL = 'v1.0';

/**
 * Projects transport for docs-hub-api.
 *
 * Every call goes through `unwrap`, which is what catches the backend's
 * business failures — those arrive as HTTP 200 with `success:false`, so reading
 * `response.data` directly would treat a failed delete as a success.
 */
export const projectsApi = {
  list: async (
    params?: { page?: number; limit?: number },
    signal?: AbortSignal
  ): Promise<Paginated<Project>> => {
    const { data } = await http.get(endpoints.projects.list, { params, signal });
    const { items, pagination } = unwrapPaginated(data, ProjectDtoSchema);
    return { items: items.map(toProject), pagination };
  },

  /**
   * Fetch one project. Returns undefined for a missing id rather than throwing,
   * so a detail screen can render "not found" instead of an error boundary.
   */
  detail: async (projectId: string, signal?: AbortSignal): Promise<Project | undefined> => {
    try {
      const { data } = await http.get(endpoints.projects.detail(projectId), { signal });
      return toProject(unwrap(data, ProjectDtoSchema));
    } catch (error) {
      if (error instanceof AppError && error.status === 404) return undefined;
      throw error;
    }
  },

  /**
   * Create a project, then give it a first draft version.
   *
   * The backend creates projects with no versions at all, and an upload must be
   * scoped to one — so a freshly created project cannot accept a single file
   * until someone makes a version. Users have no reason to know that concept
   * before they need it, so the first one is made here.
   *
   * A failure to create the version does NOT fail the call: the project exists
   * and is usable, and the upload screen can create a version on demand. Better
   * a project without a version than an orphaned project the user cannot see.
   */
  create: async (input: CreateProjectInput): Promise<Project> => {
    const { data } = await http.post(endpoints.projects.create, {
      name: input.name,
      description: input.description,
    });
    const project = toProject(unwrap(data, ProjectDtoSchema));

    await http
      .post(endpoints.versions.create(project.id), { label: FIRST_VERSION_LABEL })
      .catch(() => undefined);

    return project;
  },

  update: async (projectId: string, input: Partial<UpdateProjectInput>): Promise<Project> => {
    const { data } = await http.patch(endpoints.projects.update(projectId), {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
    });
    return toProject(unwrap(data, ProjectDtoSchema));
  },

  /**
   * Deletion requires the user to retype the project name; a mismatch comes back
   * as the business error CONFIRM_NAME_MISMATCH (HTTP 200), not a 4xx.
   * Returns 204 with no body, so there is nothing to unwrap.
   */
  remove: async (projectId: string, confirmName: string): Promise<void> => {
    await http.delete(endpoints.projects.remove(projectId), {
      data: { confirm_name: confirmName },
    });
  },

  members: async (projectId: string, signal?: AbortSignal): Promise<ProjectMember[]> => {
    const { data } = await http.get(endpoints.projects.members(projectId), { signal });
    const { items } = unwrapPaginated(data, ProjectMemberDtoSchema);
    return items.map(toProjectMember);
  },

  inviteMember: async (
    projectId: string,
    input: { userId: string; role: 'editor' | 'viewer' }
  ): Promise<ProjectMember> => {
    const { data } = await http.post(endpoints.projects.members(projectId), {
      user_id: input.userId,
      role: input.role,
    });
    return toProjectMember(unwrap(data, ProjectMemberDtoSchema));
  },

  changeMemberRole: async (
    projectId: string,
    userId: string,
    role: 'editor' | 'viewer'
  ): Promise<ProjectMember> => {
    const { data } = await http.patch(endpoints.projects.member(projectId, userId), { role });
    return toProjectMember(unwrap(data, ProjectMemberDtoSchema));
  },

  removeMember: async (projectId: string, userId: string): Promise<void> => {
    await http.delete(endpoints.projects.member(projectId, userId));
  },

  /** Settings are embedded in ProjectResponse; there is no dedicated endpoint. */
  settings: async (projectId: string, signal?: AbortSignal): Promise<ProjectSettings | null> => {
    const { data } = await http.get(endpoints.projects.list, {
      params: { limit: 100 },
      signal,
    });
    const { items } = unwrapPaginated(data, ProjectDtoSchema);
    const dto = items.find((project) => project.id === projectId);
    return dto ? toProjectSettings(dto) : null;
  },

  /**
   * Avatar upload, three legs (see the API doc):
   *  1. ask the backend for a presigned URL,
   *  2. PUT the file to that URL through the same-origin relay (the CSP blocks a
   *     direct cross-host fetch) — no Authorization header, the URL is already
   *     signed and sending one breaks the signature,
   *  3. tell the backend to verify and persist it.
   */
  uploadAvatar: async (projectId: string, file: File): Promise<Project> => {
    const { data: urlBody } = await http.post(endpoints.projects.avatarUploadUrl(projectId), {
      mime_type: file.type,
      size_bytes: file.size,
    });
    const { upload_url } = unwrap(urlBody, AvatarUploadUrlDtoSchema);

    // Relayed through a same-origin route rather than PUT straight to storage:
    // the CSP pins `connect-src` to `'self'`, so the direct request never leaves
    // the page. The relay forwards the body to the presigned URL server-side.
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
    const upload = await fetch(
      `${basePath}/api/storage-put?url=${encodeURIComponent(upload_url)}`,
      {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      }
    );
    if (!upload.ok) {
      throw new Error(`Avatar upload failed with status ${upload.status}`);
    }

    const { data } = await http.post(endpoints.projects.avatarComplete(projectId));
    return toProject(unwrap(data, ProjectDtoSchema));
  },
};
