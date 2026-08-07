import { apiSuccessSchema, endpoints } from '@/core/api';
import { http } from '@/shared/api/http';

import {
  type CreateProjectInput,
  type Project,
  ProjectListSchema,
  ProjectMemberListSchema,
  ProjectSchema,
  ProjectSettingsSchema,
  type ProjectMember,
  type ProjectSettings,
  type UpdateProjectInput,
} from '../schemas/project.schema';

/**
 * Projects transport. Every method parses the response envelope against the Zod
 * schema, so a contract drift surfaces here rather than as `undefined` deep in a
 * component. Paths come from the central `endpoints` registry — when the real API
 * lands, only that file changes.
 */
export const projectsApi = {
  list: async (search?: string, signal?: AbortSignal): Promise<Project[]> => {
    const { data } = await http.get(endpoints.projects.list, {
      params: search ? { search } : undefined,
      signal,
    });
    return apiSuccessSchema(ProjectListSchema).parse(data).data;
  },

  detail: async (projectId: string, signal?: AbortSignal): Promise<Project> => {
    const { data } = await http.get(endpoints.projects.detail(projectId), { signal });
    return apiSuccessSchema(ProjectSchema).parse(data).data;
  },

  create: async (input: CreateProjectInput): Promise<Project> => {
    const { data } = await http.post(endpoints.projects.create, input);
    return apiSuccessSchema(ProjectSchema).parse(data).data;
  },

  update: async (projectId: string, input: UpdateProjectInput): Promise<Project> => {
    const { data } = await http.patch(endpoints.projects.update(projectId), input);
    return apiSuccessSchema(ProjectSchema).parse(data).data;
  },

  remove: async (projectId: string): Promise<void> => {
    await http.delete(endpoints.projects.remove(projectId));
  },

  members: async (projectId: string, signal?: AbortSignal): Promise<ProjectMember[]> => {
    const { data } = await http.get(endpoints.projects.members(projectId), { signal });
    return apiSuccessSchema(ProjectMemberListSchema).parse(data).data;
  },

  settings: async (projectId: string, signal?: AbortSignal): Promise<ProjectSettings> => {
    const { data } = await http.get(endpoints.projects.settings(projectId), { signal });
    return apiSuccessSchema(ProjectSettingsSchema).parse(data).data;
  },

  updateSettings: async (projectId: string, input: ProjectSettings): Promise<ProjectSettings> => {
    const { data } = await http.put(endpoints.projects.settings(projectId), input);
    return apiSuccessSchema(ProjectSettingsSchema).parse(data).data;
  },
};
