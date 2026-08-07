import type * as React from 'react';

import { cn } from '@/shared/lib/utils';

/**
 * The white rounded panel every screen sits inside (mockup: `rounded-2xl border
 * bg-white shadow-sm`). `Card` is the outer shell; `CardHeader` is the bordered
 * title strip with a back button; `CardBody` is the padded content region.
 */
export function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'bg-surface border-border overflow-hidden rounded-2xl border shadow-sm',
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('border-border flex items-center gap-3 border-b px-5 py-3.5', className)}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: React.ComponentProps<'h1'>) {
  return <h1 className={cn('text-sm font-semibold tracking-tight', className)} {...props} />;
}

export function CardBody({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('p-6', className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'border-border flex items-center justify-between border-t px-6 py-3.5',
        className
      )}
      {...props}
    />
  );
}
