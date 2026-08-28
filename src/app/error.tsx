'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * Route-level error boundary.
 *
 * Without one, a render-time throw — a schema that stopped matching, an
 * unexpected null — dropped the user on Next's default error screen, outside the
 * app entirely. This keeps them inside it with a way back.
 *
 * Deliberately not localized: `useI18n` needs the provider tree, which is what
 * may have just failed. A boundary that can itself throw is not a boundary.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The digest is what correlates this with the server log; the message is
    // stripped in production builds.
    console.error('[route error]', error.digest ?? '', error);
  }, [error]);

  return (
    <div className="grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <span className="bg-status-failed-bg text-status-failed mx-auto grid size-12 place-items-center rounded-full">
          <AlertTriangle className="size-6" aria-hidden />
        </span>
        <h1 className="mt-4 text-base font-semibold tracking-tight">
          Đã xảy ra lỗi / Something went wrong
        </h1>
        <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-sm">
          Vui lòng thử lại. Nếu vẫn lỗi, báo cho quản trị viên kèm mã bên dưới.
        </p>
        {error.digest && (
          <code className="text-muted-foreground mt-2 block font-mono text-xs">{error.digest}</code>
        )}
        <button
          type="button"
          onClick={reset}
          className="border-border hover:bg-accent mt-4 inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm"
        >
          <RefreshCw className="size-3.5" aria-hidden />
          Thử lại / Retry
        </button>
      </div>
    </div>
  );
}
