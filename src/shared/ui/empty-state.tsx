import type { LucideIcon } from 'lucide-react';

import { cn } from '@/shared/lib/utils';

/** Centred icon + message block for empty lists, empty search and error states. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('grid place-items-center px-6 py-14 text-center', className)}>
      <div>
        <span className="bg-muted text-muted-foreground mx-auto grid size-12 place-items-center rounded-full">
          <Icon className="size-6" aria-hidden />
        </span>
        <p className="mt-4 text-sm font-medium">{title}</p>
        {description && (
          <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-sm">{description}</p>
        )}
        {action && <div className="mt-4">{action}</div>}
      </div>
    </div>
  );
}
