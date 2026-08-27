import type { ReactNode } from 'react';

import { I18nProvider, type Locale } from '@/core/i18n';

import { QueryProvider } from './query-provider';
import { ThemeProvider } from './theme-provider';

/**
 * Single composition point for app-wide client providers. Feature-specific
 * providers (SessionProvider in Module 5) are layered here so `app/layout.tsx`
 * stays a one-liner and provider order lives in one place.
 */
export function AppProviders({ children, locale }: { children: ReactNode; locale: Locale }) {
  return (
    <ThemeProvider>
      <I18nProvider initialLocale={locale}>
        <QueryProvider>{children}</QueryProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
