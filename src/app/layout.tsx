import type { Metadata, Viewport } from 'next';

import { AppProviders } from '@/shared/providers';

import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Document Hub',
    template: '%s · Document Hub',
  },
  description: 'Enterprise document management platform.',
  applicationName: 'Document Hub',
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
 * Locale-aware `<html lang>` arrives with the `[locale]` segment in Module 2.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-dvh antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
