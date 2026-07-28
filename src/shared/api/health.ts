import { queryOptions } from '@tanstack/react-query';

import { apiSuccessSchema } from '@/core/api/errors';

import { type Health, HealthSchema } from './health.schema';
import { http } from './http';

/**
 * Client-side health fetcher + shared query options. `healthQueryOptions` is the
 * single definition reused by client `useQuery` and (later) RSC prefetch — the
 * pattern every feature slice follows for its own queries.
 */
export async function getHealth(signal?: AbortSignal): Promise<Health> {
  const { data } = await http.get('/health', { signal });
  return apiSuccessSchema(HealthSchema).parse(data).data;
}

export const healthQueryOptions = queryOptions({
  queryKey: ['health'] as const,
  queryFn: ({ signal }) => getHealth(signal),
  staleTime: 10_000,
});

export { type Health, HealthSchema } from './health.schema';
