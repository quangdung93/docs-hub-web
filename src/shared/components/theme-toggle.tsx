'use client';

import { Moon, Sun, SunMoon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

import { type MessageKey, useI18n } from '@/core/i18n';
import { cn } from '@/shared/lib/utils';

const OPTIONS = [
  { value: 'light', labelKey: 'common.theme.light', icon: Sun },
  { value: 'dark', labelKey: 'common.theme.dark', icon: Moon },
] as const satisfies ReadonlyArray<{ value: string; labelKey: MessageKey; icon: unknown }>;

/**
 * Segmented light/dark switch, mirroring `LanguageToggle`: a leading function icon
 * then the two options. Renders a stable placeholder until mounted to avoid a
 * hydration mismatch (server has no knowledge of the resolved theme).
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const { t } = useI18n();
  const [mounted, setMounted] = useState(false);

  // Hydration guard: the server cannot know the resolved theme, so we only reflect
  // `theme` after mount to avoid an aria-checked mismatch. This one-shot flag is the
  // documented next-themes pattern; the cascading-render rule doesn't apply.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  return (
    <div
      role="radiogroup"
      aria-label={t('common.theme')}
      className={cn(
        'border-border bg-surface inline-flex items-center gap-0.5 rounded-lg border p-0.5',
        className
      )}
    >
      <SunMoon className="text-muted-foreground mx-1.5 size-3.5" aria-hidden />
      {OPTIONS.map(({ value, labelKey, icon: Icon }) => {
        const active = mounted && theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={t(labelKey)}
            onClick={() => setTheme(value)}
            className={cn(
              'text-muted-foreground inline-flex size-7 cursor-pointer items-center justify-center rounded-md transition-colors',
              'hover:text-foreground focus-visible:ring-ring/40 focus-visible:ring-2 focus-visible:outline-none',
              active && 'bg-brand text-white'
            )}
          >
            <Icon className="size-3.5" />
          </button>
        );
      })}
    </div>
  );
}
