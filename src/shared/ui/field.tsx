import type * as React from 'react';

import { cn } from '@/shared/lib/utils';

/**
 * Form field primitives. `Field` pairs a label with its control and renders the
 * validation message in a fixed slot, so forms across the app align identically
 * without each screen re-deciding label spacing.
 */
export function Label({ className, ...props }: React.ComponentProps<'label'>) {
  return <label className={cn('mb-1.5 block text-sm font-medium', className)} {...props} />;
}

export function FieldError({ className, ...props }: React.ComponentProps<'p'>) {
  return <p className={cn('text-destructive mt-1.5 text-sm', className)} {...props} />;
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  className,
  children,
}: {
  label?: string;
  htmlFor?: string;
  error?: string;
  hint?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      {(label || hint) && (
        <div className="mb-1.5 flex items-center justify-between">
          {label && (
            <label htmlFor={htmlFor} className="block text-sm font-medium">
              {label}
            </label>
          )}
          {hint}
        </div>
      )}
      {children}
      {error && <FieldError>{error}</FieldError>}
    </div>
  );
}

export function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cn(
        'border-input placeholder:text-muted-foreground focus-visible:ring-ring/40 w-full rounded-md border bg-transparent p-3 text-sm transition-colors outline-none focus-visible:ring-2',
        'aria-invalid:border-destructive disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  );
}

export function Checkbox({ className, ...props }: Omit<React.ComponentProps<'input'>, 'type'>) {
  return (
    <input
      type="checkbox"
      className={cn(
        'border-input accent-brand focus-visible:ring-ring/40 size-4 shrink-0 cursor-pointer rounded border focus-visible:ring-2 focus-visible:outline-none',
        className
      )}
      {...props}
    />
  );
}
