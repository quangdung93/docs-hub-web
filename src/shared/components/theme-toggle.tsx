'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

import { cn } from '@/shared/lib/utils';

const OPTIONS = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'dark', label: 'Dark', icon: Moon },
] as const;

/**
 * Segmented light/system/dark switch. Renders a stable placeholder until mounted
 * to avoid a hydration mismatch (server has no knowledge of the resolved theme).
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Hydration guard: the server cannot know the resolved theme, so we only reflect
  // `theme` after mount to avoid an aria-checked mismatch. This one-shot flag is the
  // documented next-themes pattern; the cascading-render rule doesn't apply.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="border-border bg-card inline-flex items-center gap-1 rounded-lg border p-1"
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = mounted && theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            onClick={() => setTheme(value)}
            className={cn(
              'text-muted-foreground inline-flex size-8 items-center justify-center rounded-md transition-colors',
              'hover:text-foreground focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
              active && 'bg-primary text-primary-foreground'
            )}
          >
            <Icon className="size-4" />
          </button>
        );
      })}
    </div>
  );
}
