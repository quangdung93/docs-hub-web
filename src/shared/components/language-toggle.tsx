'use client';

import { Languages } from 'lucide-react';

import { LOCALES, useI18n, type Locale } from '@/core/i18n';
import { cn } from '@/shared/lib/utils';

const LABELS: Record<Locale, string> = { vi: 'VI', en: 'EN' };

/** Two-state VI/EN switch, mirroring the segmented look of `ThemeToggle`. */
export function LanguageToggle({ className }: { className?: string }) {
  const { locale, setLocale, t } = useI18n();

  return (
    <div
      role="radiogroup"
      aria-label={t('common.language')}
      className={cn(
        'border-border bg-surface inline-flex items-center gap-0.5 rounded-lg border p-0.5',
        className
      )}
    >
      <Languages className="text-muted-foreground mx-1.5 size-3.5" aria-hidden />
      {LOCALES.map((value) => {
        const active = value === locale;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setLocale(value)}
            className={cn(
              'focus-visible:ring-ring/40 cursor-pointer rounded-md px-2 py-1 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none',
              active ? 'bg-brand text-white' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {LABELS[value]}
          </button>
        );
      })}
    </div>
  );
}
