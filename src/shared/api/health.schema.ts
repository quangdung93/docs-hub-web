import { z } from 'zod';

/**
 * Health contract — schema only, no transport imports, so both the MSW mock and
 * the client/server fetchers can share it without pulling in Axios or React Query.
 */
export const HealthSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  service: z.string(),
  version: z.string(),
  uptimeSeconds: z.number().nonnegative(),
  timestamp: z.iso.datetime(),
});

export type Health = z.infer<typeof HealthSchema>;
