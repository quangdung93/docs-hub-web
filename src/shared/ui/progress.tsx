import { cn } from '@/shared/lib/utils';

/**
 * Slim progress track. `value === undefined` renders the indeterminate sweep used
 * while a document is being embedded (no percentage is knowable server-side).
 */
export function Progress({
  value,
  label,
  className,
}: {
  value?: number;
  label: string;
  className?: string;
}) {
  const indeterminate = value === undefined;
  const clamped = indeterminate ? 0 : Math.min(100, Math.max(0, value));

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={indeterminate ? undefined : clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn(
        'bg-muted relative h-1.5 overflow-hidden rounded-full',
        indeterminate && 'indeterminate-bar bg-brand-subtle',
        className
      )}
    >
      {!indeterminate && (
        <span
          className="bg-brand block h-full rounded-full transition-[width] duration-300"
          style={{ width: `${clamped}%` }}
        />
      )}
    </div>
  );
}
