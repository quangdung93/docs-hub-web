import type { ReactNode } from 'react';

import { QueryProvider } from './query-provider';
import { ThemeProvider } from './theme-provider';

/**
 * Single composition point for app-wide client providers. Feature-specific
 * providers (SessionProvider in Module 5) are layered here so `app/layout.tsx`
 * stays a one-liner and provider order lives in one place.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <QueryProvider>{children}</QueryProvider>
    </ThemeProvider>
  );
}
