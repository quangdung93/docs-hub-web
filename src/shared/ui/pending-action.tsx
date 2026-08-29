'use client';

import { useState } from 'react';

import { ConfirmDialog } from './confirm-dialog';

/**
 * A destructive-looking action whose backend does not exist yet.
 *
 * The UI is built ahead of the API on purpose, so reviewers can walk the flow.
 * That only stays honest if the flow never implies the data changed: this asks
 * the real question first, then — instead of doing the thing — says the feature
 * is still being built. Two dialogs rather than one, because collapsing them
 * into a single "coming soon" hides the confirmation step that the finished
 * feature will have, which is exactly the part worth reviewing.
 *
 * Delete this component, not just its call sites, once every action it guards
 * has a real endpoint — it exists to be temporary.
 */
export function usePendingAction() {
  const [confirming, setConfirming] = useState<{ title: string; description: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  return {
    /** Opens the confirmation for an action that will not actually run. */
    request: (title: string, description: string) => setConfirming({ title, description }),
    confirming,
    notice,
    acknowledgeConfirm: () => {
      setNotice(confirming?.title ?? '');
      setConfirming(null);
    },
    dismissConfirm: () => setConfirming(null),
    dismissNotice: () => setNotice(null),
  };
}

/** Renders the pair of dialogs driven by `usePendingAction`. */
export function PendingActionDialogs({
  state,
  confirmLabel,
  cancelLabel,
  doneLabel,
  noticeDescription,
}: {
  state: ReturnType<typeof usePendingAction>;
  confirmLabel: string;
  cancelLabel: string;
  doneLabel: string;
  noticeDescription: string;
}) {
  return (
    <>
      <ConfirmDialog
        open={state.confirming !== null}
        title={state.confirming?.title ?? ''}
        description={state.confirming?.description ?? ''}
        confirmLabel={confirmLabel}
        cancelLabel={cancelLabel}
        onConfirm={state.acknowledgeConfirm}
        onCancel={state.dismissConfirm}
      />
      <ConfirmDialog
        open={state.notice !== null}
        title={state.notice ?? ''}
        description={noticeDescription}
        confirmLabel={doneLabel}
        cancelLabel={cancelLabel}
        onConfirm={state.dismissNotice}
        onCancel={state.dismissNotice}
        variant="notice"
      />
    </>
  );
}
