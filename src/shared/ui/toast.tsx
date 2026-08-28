'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { AlertTriangle, X } from 'lucide-react';

import { cn } from '@/shared/lib/utils';

/**
 * Transient error notices.
 *
 * A failed mutation has nowhere to render: the user pressed Save or Delete and
 * the screen looks unchanged, so silence reads as success. This is the channel
 * for those — driven from `QueryProvider`'s `MutationCache.onError`, so a
 * mutation does not have to remember to report anything.
 *
 * ponytail: a module-level array with listeners, not a context or a store.
 * Nothing reads it but the viewport, and it must be writable from outside React
 * (the mutation cache callback runs there).
 */
export type Toast = { id: number; message: string };

const toasts: Toast[] = [];
const listeners = new Set<() => void>();

/** Reassigned only on write, so `useSyncExternalStore` does not loop. */
let snapshot: readonly Toast[] = [];
let counter = 0;

/** Stable empty array for the server snapshot — a new [] each call would loop. */
const EMPTY: readonly Toast[] = [];

function emit() {
  snapshot = [...toasts];
  listeners.forEach((listener) => listener());
}

export function showErrorToast(message: string) {
  toasts.unshift({ id: ++counter, message });
  // Three is enough to notice a burst without burying the screen.
  if (toasts.length > 3) toasts.length = 3;
  emit();
}

export function dismissToast(id: number) {
  const index = toasts.findIndex((toast) => toast.id === id);
  if (index >= 0) {
    toasts.splice(index, 1);
    emit();
  }
}

function ToastRow({ toast }: { toast: Toast }) {
  // Auto-dismiss, but only after the user has had time to read it. Errors stay
  // longer than a success would.
  useEffect(() => {
    const timer = setTimeout(() => dismissToast(toast.id), 8000);
    return () => clearTimeout(timer);
  }, [toast.id]);

  return (
    <div
      role="alert"
      className={cn(
        'border-status-failed/40 bg-surface flex items-start gap-2.5 rounded-lg border p-3 shadow-lg',
        'w-[min(24rem,calc(100vw-2rem))]'
      )}
    >
      <AlertTriangle className="text-status-failed mt-0.5 size-4 shrink-0" aria-hidden />
      <p className="flex-1 text-sm break-words">{toast.message}</p>
      <button
        type="button"
        onClick={() => dismissToast(toast.id)}
        className="text-muted-foreground hover:text-foreground shrink-0"
        aria-label="Đóng"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}

export function ToastViewport() {
  const items = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => snapshot,
    // Server snapshot: never any toasts to show during SSR.
    () => EMPTY
  );

  // The server snapshot is always empty, so the first client paint matches the
  // markup React rendered on the server — no hydration mismatch, and no
  // `useState` + effect dance to arrange it.
  if (items.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 flex-col gap-2">
      {items.map((toast) => (
        <ToastRow key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
