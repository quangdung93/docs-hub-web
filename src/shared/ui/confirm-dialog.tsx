'use client';

import { useEffect, useRef, useState } from 'react';

import { Button } from './button';
import { Input } from './input';

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
  confirmPhrase,
  confirmPhraseLabel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  /** Receives the typed phrase when `confirmPhrase` is set, otherwise nothing. */
  onConfirm: (typed: string) => void;
  onCancel: () => void;
  pending?: boolean;
  /**
   * When set, the user must type this exact phrase before confirming. Used for
   * project deletion, where the backend itself requires the name as proof of
   * intent and rejects a mismatch with CONFIRM_NAME_MISMATCH.
   */
  confirmPhrase?: string;
  confirmPhraseLabel?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [typed, setTyped] = useState('');

  // Clear the field between openings so a previous attempt cannot pre-arm the
  // confirm button. Reset during render rather than in an effect — the value is
  // derived from `open`, and an effect would briefly render the stale text.
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (!open) setTyped('');
  }

  const phraseSatisfied = !confirmPhrase || typed.trim() === confirmPhrase;

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

        {confirmPhrase && (
          <div className="mt-4">
            {confirmPhraseLabel && (
              <label htmlFor="confirm-phrase" className="mb-1.5 block text-sm font-medium">
                {confirmPhraseLabel}
              </label>
            )}
            <Input
              id="confirm-phrase"
              value={typed}
              autoComplete="off"
              placeholder={confirmPhrase}
              onChange={(event) => setTyped(event.target.value)}
            />
          </div>
        )}

        <div className="mt-5 flex items-center justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => onConfirm(typed.trim())}
            disabled={pending || !phraseSatisfied}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
