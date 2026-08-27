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
    <div className="group relative hidden flex-col justify-between overflow-hidden bg-black p-10 text-white md:flex">
      {/* Library backdrop — shown as-is, no brand tint. Zooms in gently on hover;
          the bottom scrim keeps the white copy legible over it. */}
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-center transition-transform duration-700 ease-out group-hover:scale-105"
        // Prefixed explicitly: Next rewrites its own asset URLs for `basePath`
        // but not paths hardcoded inside CSS, so a bare `/login-hero.jpg` would
        // resolve to the domain root and 404 under the sub-path deployment.
        style={{
          backgroundImage: `url('${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/login-hero.jpg')`,
        }}
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/20" />

      <div className="relative flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-md bg-white/15 font-bold">D</span>
          <span className="font-semibold tracking-tight">{t('app.name')}</span>
        </div>
      </div>

      <div className="relative">
        <span className="text-brand block font-serif text-4xl leading-none" aria-hidden>
          &ldquo;
        </span>
        <h2 className="mt-1 text-3xl leading-snug font-bold [text-shadow:0_1px_12px_rgb(0_0_0/0.5)]">
          {t('login.hero.title')}
        </h2>
        <p className="mt-2 text-base text-white/90 italic">{t('app.tagline')}</p>
        <p className="mt-4 max-w-xs text-sm text-white/80">{t('login.hero.description')}</p>
      </div>

      <div className="relative flex items-center justify-between gap-3">
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
