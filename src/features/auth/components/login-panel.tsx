'use client';

import type { ReactNode } from 'react';

import { useI18n } from '@/core/i18n';
import { LanguageToggle, ThemeToggle } from '@/shared/components';

/**
 * Right half of the login screen: heading, the form (passed in as children so the
 * form stays independently testable), and the admin-contact footnote. The toggles
 * repeat here for the mobile layout, where `LoginHero` is hidden.
 */
export function LoginPanel({ children }: { children: ReactNode }) {
  const { t } = useI18n();

  return (
    <div className="flex items-center justify-center p-8">
      <div className="w-full max-w-sm">
        <div className="mb-4 flex items-center justify-end gap-1.5 md:hidden">
          <LanguageToggle />
          <ThemeToggle />
        </div>

        <h1 className="text-xl font-semibold tracking-tight">{t('login.title')}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t('login.subtitle')}</p>

        {children}

        <p className="text-muted-foreground mt-6 text-center text-xs">{t('login.needAccount')}</p>
      </div>
    </div>
  );
}
