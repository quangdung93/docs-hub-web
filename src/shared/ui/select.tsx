'use client';

import { ChevronDown, type LucideIcon } from 'lucide-react';
import { useId } from 'react';

import { cn } from '@/shared/lib/utils';

/**
 * Filter dropdown. Built on a native `<select>` on purpose: keyboard navigation,
 * type-ahead, the mobile OS picker and screen-reader semantics all come for free,
 * and none of them are worth re-implementing with a custom popup. The chevron and
 * optional leading icon are overlaid; the select itself is transparent.
 */
export function Select<T extends string>({
  value,
  onValueChange,
  options,
  label,
  icon: Icon,
  className,
}: {
  value: T;
  onValueChange: (value: T) => void;
  options: ReadonlyArray<{ value: T; label: string }>;
  /** Accessible name — rendered as a visually hidden <label>. */
  label: string;
  icon?: LucideIcon;
  className?: string;
}) {
  const id = useId();

  return (
    <div
      className={cn(
        'border-border text-muted-foreground focus-within:ring-ring/40 relative inline-flex h-9 items-center rounded-md border pr-8 pl-3 text-sm transition-colors focus-within:ring-2',
        'hover:bg-accent',
        className
      )}
    >
      <label htmlFor={id} className="sr-only">
        {label}
      </label>

      {Icon && <Icon className="mr-1.5 size-3.5 shrink-0" aria-hidden />}

      <select
        id={id}
        value={value}
        onChange={(event) => onValueChange(event.target.value as T)}
        className="text-foreground cursor-pointer appearance-none bg-transparent pr-1 outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <ChevronDown className="pointer-events-none absolute right-2.5 size-4 shrink-0" aria-hidden />
    </div>
  );
}
