'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

import { useI18n } from '@/core/i18n';

import { LanguageToggle } from './language-toggle';
import { ThemeToggle } from './theme-toggle';

/**
 * Sticky application bar — logo only, per the mockup (navigation lives inside
 * each screen). The locale and theme switches sit here because they are global
 * preferences, not screen-level actions. `actions` is a slot the (feature-aware)
 * layout fills — e.g. the signed-in user menu — so this stays feature-agnostic.
 */
export function AppTopBar({ actions }: { actions?: ReactNode }) {
  const { t } = useI18n();

  return (
    <header className="border-border bg-surface-muted/90 sticky top-0 z-30 border-b backdrop-blur">
      <div className="mx-auto flex max-w-[1536px] items-center gap-2 px-4 py-2.5 lg:px-6">
        <Link href="/projects" className="flex items-center gap-2">
          <span className="bg-brand grid size-7 place-items-center rounded-md font-bold text-white">
            D
          </span>
          <span className="text-sm font-semibold tracking-tight">{t('app.name')}</span>
        </Link>

        <div className="ml-auto flex items-center gap-2">
          <LanguageToggle />
          <ThemeToggle />
          {actions}
        </div>
      </div>
    </header>
  );
}
