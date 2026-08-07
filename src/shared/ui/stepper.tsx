import { Check } from 'lucide-react';

import { cn } from '@/shared/lib/utils';

/**
 * Numbered step indicator for the two-step create-project wizard. Completed steps
 * flip to a check mark; the connector line fills as you advance.
 */
export function Stepper({
  steps,
  current,
  className,
}: {
  steps: readonly string[];
  /** 1-based index of the active step. */
  current: number;
  className?: string;
}) {
  return (
    <ol className={cn('flex items-center gap-3 text-sm', className)}>
      {steps.map((label, index) => {
        const step = index + 1;
        const done = step < current;
        const active = step === current;
        return (
          <li key={label} className="flex flex-1 items-center gap-3 last:flex-none">
            <div className="flex items-center gap-2">
              <span
                aria-current={active ? 'step' : undefined}
                className={cn(
                  'grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold transition-colors',
                  done && 'bg-status-approved text-white',
                  active && 'bg-brand text-white',
                  !done && !active && 'bg-muted text-muted-foreground'
                )}
              >
                {done ? <Check className="size-3.5" aria-hidden /> : step}
              </span>
              <span
                className={cn(
                  'whitespace-nowrap',
                  active ? 'text-foreground font-medium' : 'text-muted-foreground'
                )}
              >
                {label}
              </span>
            </div>
            {step < steps.length && <span className="bg-border h-px flex-1" />}
          </li>
        );
      })}
    </ol>
  );
}
