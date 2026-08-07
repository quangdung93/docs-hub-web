'use client';

import { cn } from '@/shared/lib/utils';

/**
 * Underline tab bar (mockup's `.subtab`). Controlled — the owning screen decides
 * where the active value lives (component state today, URL `searchParams` when a
 * deep-linkable tab is needed) so this stays a pure renderer.
 */
export function Tabs<T extends string>({
  items,
  value,
  onValueChange,
  className,
}: {
  items: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onValueChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div role="tablist" className={cn('border-border flex gap-6 border-b px-6 text-sm', className)}>
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onValueChange(item.value)}
            className={cn(
              'focus-visible:ring-ring/40 -mb-px cursor-pointer border-b-2 py-3 transition-colors focus-visible:ring-2 focus-visible:outline-none',
              active
                ? 'border-brand text-brand font-semibold'
                : 'text-muted-foreground hover:text-foreground border-transparent'
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
