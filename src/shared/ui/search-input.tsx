'use client';

import { Search } from 'lucide-react';
import type * as React from 'react';

import { cn } from '@/shared/lib/utils';

/**
 * Icon-prefixed search field. Used by the project grid, member table and document
 * table — one implementation so the 36px height, ring and icon spacing stay
 * identical everywhere. The border lives on the wrapper; the input is borderless.
 */
export function SearchInput({ className, ...props }: Omit<React.ComponentProps<'input'>, 'type'>) {
  return (
    <div
      className={cn(
        'border-input focus-within:ring-ring/40 flex h-9 items-center rounded-md border px-3 focus-within:ring-2',
        className
      )}
    >
      <Search className="text-muted-foreground mr-2 size-4 shrink-0" aria-hidden />
      <input
        type="search"
        className="placeholder:text-muted-foreground w-full bg-transparent text-sm outline-none [&::-webkit-search-cancel-button]:appearance-none"
        {...props}
      />
    </div>
  );
}
