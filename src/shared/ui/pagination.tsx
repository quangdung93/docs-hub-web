'use client';

import { cn } from '@/shared/lib/utils';

/**
 * Compact numeric pager. Controlled by the caller so page state can live wherever
 * it belongs (URL `searchParams` for shareable lists, local state for dialogs).
 */
export function Pagination({
  page,
  pageCount,
  onPageChange,
  previousLabel,
  nextLabel,
  className,
}: {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  previousLabel: string;
  nextLabel: string;
  className?: string;
}) {
  if (pageCount <= 1) return null;

  const cell =
    'focus-visible:ring-ring/40 cursor-pointer rounded-md px-2.5 py-1 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <nav className={cn('flex items-center gap-1', className)}>
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className={cn(cell, 'border-border text-muted-foreground hover:bg-accent border')}
      >
        {previousLabel}
      </button>

      {Array.from({ length: pageCount }, (_, index) => index + 1).map((value) => (
        <button
          key={value}
          type="button"
          aria-current={value === page ? 'page' : undefined}
          onClick={() => onPageChange(value)}
          className={cn(
            cell,
            value === page
              ? 'bg-brand font-medium text-white'
              : 'border-border text-muted-foreground hover:bg-accent border'
          )}
        >
          {value}
        </button>
      ))}

      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= pageCount}
        className={cn(cell, 'border-border text-muted-foreground hover:bg-accent border')}
      >
        {nextLabel}
      </button>
    </nav>
  );
}
