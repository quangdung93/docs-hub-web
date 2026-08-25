import 'server-only';

import { QueryClient } from '@tanstack/react-query';

/**
 * A throwaway QueryClient for prefetching inside a Server Component.
 *
 * Deliberately not the browser singleton from `shared/providers/query-provider`:
 * that module is `'use client'`, and a client cache shared across server requests
 * would leak one user's data into another's response. Each request gets its own,
 * it is dehydrated into the HTML, and then discarded.
 */
export function createServerQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Must be > 0, or the client refetches on mount and the prefetch buys
        // nothing. Matches the client-side list staleTime.
        staleTime: 15_000,
      },
    },
  });
}
