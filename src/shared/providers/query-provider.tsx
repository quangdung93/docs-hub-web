'use client';

import { isServer, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

import { AppError } from '@/core/api/errors';

/**
 * Defaults tuned for a BFF app:
 *  - `staleTime` > 0 so RSC-prefetched data isn't immediately refetched on mount.
 *  - No retry on 4xx (a 401/403/404 won't fix itself); retry other errors twice.
 *  - `refetchOnWindowFocus` off — noisy for an internal tool.
 */
function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          if (error instanceof AppError && error.status >= 400 && error.status < 500) return false;
          return failureCount < 2;
        },
      },
      mutations: { retry: false },
    },
  });
}

// On the server every request must get a fresh client; in the browser we keep a
// singleton so React Strict Mode / re-renders don't discard the cache.
let browserQueryClient: QueryClient | undefined;

function getQueryClient(): QueryClient {
  if (isServer) return makeQueryClient();
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(getQueryClient);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
