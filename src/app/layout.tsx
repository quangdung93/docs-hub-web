import type { Metadata, Viewport } from 'next';

import { getLocale } from '@/core/i18n/server';
import { ApiInspector } from '@/shared/components';
import { AppProviders } from '@/shared/providers';

import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Docs Hub',
    template: '%s · Docs Hub',
  },
  description: 'Enterprise document management platform.',
  applicationName: 'Docs Hub',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
};

/**
 * Root layout. `suppressHydrationWarning` on <html> is required because
 * next-themes writes the `class`/`style` attributes before React hydrates.
 * The locale is read from its cookie server-side so the first paint is already
 * in the right language — no flash of the default locale.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className="min-h-dvh antialiased">
        <AppProviders locale={locale}>
          {children}
          {/* Dev/test aid: hidden in production so it never ships to end users. */}
          {process.env.NEXT_PUBLIC_APP_ENV !== 'production' && <ApiInspector />}
        </AppProviders>
      </body>
    </html>
  );
}
