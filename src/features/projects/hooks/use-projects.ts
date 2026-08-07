'use client';

import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import { queryKeys } from '@/core/api';

import { projectsApi } from '../api/projects.api';
import { projectRoutes } from '../routes';
import type { ProjectSettings, UpdateProjectInput } from '../schemas/project.schema';

/**
 * Query definitions live next to the hooks so RSC prefetch and client `useQuery`
 * share one source (the pattern the documents slice sets). Mutations invalidate
 * through the central `queryKeys` factory rather than re-declaring key arrays.
 */
export const projectListQueryOptions = (search?: string) =>
  queryOptions({
    queryKey: queryKeys.projects.list(search),
    queryFn: ({ signal }) => projectsApi.list(search, signal),
    staleTime: 30_000,
  });

export const projectDetailQueryOptions = (projectId: string) =>
  queryOptions({
    queryKey: queryKeys.projects.detail(projectId),
    queryFn: ({ signal }) => projectsApi.detail(projectId, signal),
    staleTime: 30_000,
  });

export const projectMembersQueryOptions = (projectId: string) =>
  queryOptions({
    queryKey: queryKeys.projects.members(projectId),
    queryFn: ({ signal }) => projectsApi.members(projectId, signal),
    staleTime: 30_000,
  });

export const projectSettingsQueryOptions = (projectId: string) =>
  queryOptions({
    queryKey: queryKeys.projects.settings(projectId),
    queryFn: ({ signal }) => projectsApi.settings(projectId, signal),
    staleTime: 30_000,
  });

export function useProjects(search?: string) {
  return useQuery(projectListQueryOptions(search));
}

export function useProject(projectId: string) {
  return useQuery(projectDetailQueryOptions(projectId));
}

export function useProjectMembers(projectId: string) {
  return useQuery(projectMembersQueryOptions(projectId));
}

export function useProjectSettings(projectId: string) {
  return useQuery(projectSettingsQueryOptions(projectId));
}

/** Create a project, then hand the caller the new id so the wizard can advance. */
export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: projectsApi.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.projects.all }),
  });
}

export function useUpdateProject(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateProjectInput) => projectsApi.update(projectId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.projects.all }),
  });
}

export function useUpdateProjectSettings(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ProjectSettings) => projectsApi.updateSettings(projectId, input),
    onSuccess: (data) => queryClient.setQueryData(queryKeys.projects.settings(projectId), data),
  });
}

/** Delete a project and return to the project picker — the row is gone, so the
 *  detail cache must be dropped rather than refetched (it would 404). */
export function useDeleteProject(projectId: string) {
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: () => projectsApi.remove(projectId),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: queryKeys.projects.detail(projectId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      router.push(projectRoutes.list);
    },
  });
}
