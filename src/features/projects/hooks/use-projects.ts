'use client';

import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import { queryKeys } from '@/core/api';

import { projectsApi } from '../api/projects.api';
import { projectRoutes } from '../routes';
import type { UpdateProjectInput } from '../schemas/project.schema';

/**
 * Query definitions live next to the hooks so RSC prefetch and client `useQuery`
 * share one source (the pattern the documents slice sets). Mutations invalidate
 * through the central `queryKeys` factory rather than re-declaring key arrays.
 */
export const projectListQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.projects.list(),
    // The picker filters client-side, so pull a generous page rather than a
    // request per keystroke. Revisit if a tenant outgrows one page.
    queryFn: ({ signal }) => projectsApi.list({ limit: 100 }, signal),
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

export function useProjects() {
  return useQuery(projectListQueryOptions());
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

/**
 * Settings are read-only for now: docs-hub-api has no endpoint to write them
 * (`PATCH /projects/{id}` accepts a `settings` object, but the security toggles
 * the UI shows do not exist server-side). Wire this up once the contract covers
 * the fields the panel edits.
 */

/** Delete a project and return to the project picker — the row is gone, so the
 *  detail cache must be dropped rather than refetched (it would 404). */
export function useDeleteProject(projectId: string) {
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation({
    // The backend requires the typed project name as confirmation; a mismatch
    // comes back as CONFIRM_NAME_MISMATCH on HTTP 200.
    mutationFn: (confirmName: string) => projectsApi.remove(projectId, confirmName),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: queryKeys.projects.detail(projectId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      router.push(projectRoutes.list);
    },
  });
}
