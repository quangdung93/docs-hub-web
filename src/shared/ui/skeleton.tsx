import { cn } from '@/shared/lib/utils';

/** Pulsing placeholder block for query loading states. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('bg-muted animate-pulse rounded-md', className)} />;
}
