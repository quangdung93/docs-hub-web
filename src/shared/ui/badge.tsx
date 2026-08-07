import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';

import { cn } from '@/shared/lib/utils';

/**
 * Rounded status pill. The `indexed | processing | queued | failed` variants map
 * to the pipeline tokens in globals.css, so document rows, the upload queue and
 * the member table all share one colour vocabulary in both themes.
 */
const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap',
  {
    variants: {
      variant: {
        neutral: 'bg-muted text-muted-foreground',
        brand: 'bg-brand-subtle text-brand-dark',
        indexed: 'bg-status-indexed-bg text-status-indexed',
        processing: 'bg-status-processing-bg text-status-processing',
        queued: 'bg-status-queued-bg text-status-queued',
        failed: 'bg-status-failed-bg text-status-failed',
      },
    },
    defaultVariants: { variant: 'neutral' },
  }
);

export interface BadgeProps
  extends React.ComponentProps<'span'>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, className }))} {...props} />;
}

export { badgeVariants };
