'use client';

import { ShieldCheck } from 'lucide-react';

import { useI18n } from '@/core/i18n';
import { LanguageToggle, ThemeToggle } from '@/shared/components';

/**
 * Branded left panel of the login screen. Hidden below `md` (the mockup drops it
 * on mobile). The locale/theme switches live here because the login page sits
 * outside the authenticated shell that normally hosts them.
 */
export function LoginHero() {
  const { t } = useI18n();

  return (
    <div className="from-brand-ink to-brand-dark relative hidden flex-col justify-between bg-gradient-to-br p-10 text-white md:flex">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-md bg-white/15 font-bold">D</span>
          <span className="font-semibold tracking-tight">{t('app.name')}</span>
        </div>
      </div>

      <div>
        <h2 className="text-3xl leading-snug font-bold">{t('login.hero.title')}</h2>
        <p className="mt-2 text-base text-white/80 italic">{t('app.tagline')}</p>
        <p className="mt-4 max-w-xs text-sm text-white/70">{t('login.hero.description')}</p>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-xs text-white/60">
          <ShieldCheck className="size-4 shrink-0" aria-hidden />
          {t('login.hero.security')}
        </p>
        <div className="flex items-center gap-1.5">
          <LanguageToggle className="border-white/20 bg-white/10" />
          <ThemeToggle className="border-white/20 bg-white/10" />
        </div>
      </div>
    </div>
  );
}
