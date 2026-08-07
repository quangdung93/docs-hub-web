'use client';

import { useEffect, useRef } from 'react';

import { Button } from './button';

/**
 * Confirmation gate for destructive actions, built on the native `<dialog>` —
 * the platform already provides the focus trap, backdrop, Escape handling and
 * `aria-modal` semantics, so there is nothing here worth re-implementing.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  pending,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  pending?: boolean;
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
        onCancel();
      }}
      className="bg-surface text-foreground border-border m-auto w-[min(28rem,calc(100vw-2rem))] rounded-xl border p-0 shadow-lg backdrop:bg-black/40"
    >
      <div className="p-5">
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        <p className="text-muted-foreground mt-2 text-sm">{description}</p>

        <div className="mt-5 flex items-center justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
            {cancelLabel}
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm} disabled={pending}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
