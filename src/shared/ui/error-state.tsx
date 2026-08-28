import { AlertTriangle, RefreshCw } from 'lucide-react';

import { AppError } from '@/core/api/errors';
import { cn } from '@/shared/lib/utils';

import { Button } from './button';

/**
 * What a screen shows when its data could not be loaded.
 *
 * Before this, a failed list query fell through to the empty state — so "the
 * server is down" and "you have no documents yet" looked identical, and the user
 * had no reason to retry. Anything that fails to load should say so.
 *
 * Takes the raw error rather than a string: `AppError` already carries a
 * human-readable `message` from the backend, and re-deriving it at every call
 * site would lose the specifics ("File vượt quá dung lượng" becomes "Đã có lỗi").
 */
export function messageOf(error: unknown, fallback: string): string {
  if (error instanceof AppError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export function ErrorState({
  error,
  title,
  fallbackMessage,
  retryLabel,
  onRetry,
  className,
}: {
  error: unknown;
  title: string;
  /** Used when the error carries no message of its own. */
  fallbackMessage: string;
  retryLabel: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div className={cn('grid place-items-center px-6 py-14 text-center', className)}>
      <div>
        <span className="bg-status-failed-bg text-status-failed mx-auto grid size-12 place-items-center rounded-full">
          <AlertTriangle className="size-6" aria-hidden />
        </span>
        <p className="mt-4 text-sm font-medium">{title}</p>
        <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-sm break-words">
          {messageOf(error, fallbackMessage)}
        </p>
        {onRetry && (
          <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
            <RefreshCw className="size-3.5" aria-hidden />
            {retryLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
