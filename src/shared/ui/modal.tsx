'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { type LucideIcon } from 'lucide-react';

import { IconButton } from './icon-button';

/**
 * A modal with arbitrary body content, on the same native `<dialog>` as
 * `ConfirmDialog` — the platform gives the focus trap, backdrop, Escape and
 * `aria-modal` semantics for free.
 *
 * `ConfirmDialog` stays separate rather than growing a `children` prop: it
 * answers one question with two buttons and its whole value is that callers
 * cannot get that wrong. This is for forms, which need their own footer.
 */
export function Modal({
  open,
  title,
  icon: Icon,
  onClose,
  children,
  footer,
  className,
}: {
  open: boolean;
  title: string;
  icon?: LucideIcon;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className={`bg-surface text-foreground border-border m-auto w-[min(32rem,calc(100vw-2rem))] rounded-xl border p-0 shadow-lg backdrop:bg-black/40 ${className ?? ''}`}
    >
      <div className="border-border flex items-center justify-between gap-3 border-b px-5 py-4">
        <div className="flex items-center gap-2.5">
          {Icon && (
            <span className="bg-brand-subtle text-brand grid size-9 shrink-0 place-items-center rounded-md">
              <Icon className="size-4" aria-hidden />
            </span>
          )}
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        </div>
        <IconButton icon={X} size="sm" label="Close" onClick={onClose} />
      </div>

      <div className="px-5 py-4 text-sm">{children}</div>

      {footer && (
        <div className="border-border flex items-center justify-end gap-2 border-t px-5 py-4">
          {footer}
        </div>
      )}
    </dialog>
  );
}
