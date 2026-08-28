'use client';

import { isServer, MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

import { AppError } from '@/core/api/errors';
import { ToastViewport, showErrorToast } from '@/shared/ui/toast';

/**
 * Defaults tuned for a BFF app:
 *  - `staleTime` > 0 so RSC-prefetched data isn't immediately refetched on mount.
 *  - No retry on 4xx (a 401/403/404 won't fix itself); retry other errors twice.
 *  - `refetchOnWindowFocus` off — noisy for an internal tool.
 */
function makeQueryClient(): QueryClient {
  return new QueryClient({
    /**
     * Every failed mutation surfaces, without each call site having to remember
     * an `onError`. A mutation is something the user asked for — Save, Delete,
     * Create — so silence after a failure reads as success. Queries are NOT
     * handled here: a list that fails belongs inline on the screen (ErrorState),
     * not in a toast that disappears.
     */
    mutationCache: new MutationCache({
      onError: (error) => {
        const message = error instanceof AppError ? error.message : (error as Error)?.message;
        if (message) showErrorToast(message);
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        // 30 minutes, not the 5-minute default: the document list costs 21
        // requests to rebuild (~1.5s), and 5 minutes is shorter than a couple of
        // chat answers — long enough to walk away from a screen and come back to
        // a cold cache for data that has not changed.
        gcTime: 30 * 60_000,
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

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ToastViewport />
    </QueryClientProvider>
  );
}
