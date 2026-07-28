import type { ReactNode } from 'react';

import { ThemeProvider } from './theme-provider';

/**
 * Single composition point for app-wide client providers. Feature-specific
 * providers (QueryClient in Module 3, SessionProvider in Module 5) are layered
 * here so `app/layout.tsx` stays a one-liner and provider order lives in one place.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}
