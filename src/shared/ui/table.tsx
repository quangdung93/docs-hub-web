import type * as React from 'react';

import { cn } from '@/shared/lib/utils';

/**
 * Bordered data table used by the document list and the member list. `DataTable`
 * is the rounded frame; the rest are thin styled wrappers so both tables share
 * header casing, row dividers and hover treatment.
 */
export function DataTable({ className, children }: React.ComponentProps<'div'>) {
  return (
    <div className={cn('border-border overflow-hidden rounded-xl border', className)}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">{children}</table>
      </div>
    </div>
  );
}

export function TableHead({ className, ...props }: React.ComponentProps<'thead'>) {
  return (
    <thead
      className={cn(
        'bg-surface-muted text-muted-foreground text-xs tracking-wide uppercase',
        className
      )}
      {...props}
    />
  );
}

export function TableRow({ className, ...props }: React.ComponentProps<'tr'>) {
  return (
    <tr
      className={cn('border-border/70 hover:bg-surface-muted/60 border-t', className)}
      {...props}
    />
  );
}

export function TableHeaderCell({ className, ...props }: React.ComponentProps<'th'>) {
  return <th className={cn('p-3 text-left font-semibold', className)} {...props} />;
}

export function TableCell({ className, ...props }: React.ComponentProps<'td'>) {
  return <td className={cn('p-3', className)} {...props} />;
}

/** Full-width message row for empty / filtered-out tables. */
export function TableEmptyRow({
  colSpan,
  children,
}: {
  colSpan: number;
  children: React.ReactNode;
}) {
  return (
    <tr className="border-border/70 border-t">
      <td colSpan={colSpan} className="text-muted-foreground p-8 text-center text-sm">
        {children}
      </td>
    </tr>
  );
}
