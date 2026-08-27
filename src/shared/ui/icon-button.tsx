import type { LucideIcon } from 'lucide-react';
import type * as React from 'react';

import { cn } from '@/shared/lib/utils';

/**
 * Square icon-only action (back arrows, row actions, close buttons). Always takes
 * a `label` — the mockup's bare `<i>` icons carry no accessible name, and row
 * actions are otherwise unreachable by keyboard or screen reader.
 */
export function IconButton({
  icon: Icon,
  label,
  className,
  size = 'md',
  ...props
}: React.ComponentProps<'button'> & {
  icon: LucideIcon;
  label: string;
  size?: 'sm' | 'md';
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring/40 grid cursor-pointer place-items-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
        size === 'sm' ? 'size-7' : 'size-8',
        className
      )}
      {...props}
    >
      <Icon className={size === 'sm' ? 'size-3.5' : 'size-4'} aria-hidden />
    </button>
  );
}
