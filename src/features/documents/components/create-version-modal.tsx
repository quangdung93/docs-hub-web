'use client';

import { useState } from 'react';
import { GitBranch } from 'lucide-react';

import { useI18n } from '@/core/i18n';
import { Button, Field, Input, Modal, Textarea } from '@/shared/ui';

/**
 * Name a new project version.
 *
 * The name is free text and required — the backend accepts any label and gives
 * no default, so a version created without one is an unlabelled row nobody can
 * identify later. The note is collected but the backend drops it today
 * (verified 28/08/2026); it is sent regardless, see `versionsApi.create`.
 */
export function CreateVersionModal({
  open,
  onClose,
  onCreate,
  isPending,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (label: string, note?: string) => Promise<unknown>;
  isPending?: boolean;
}) {
  const { t } = useI18n();
  const [label, setLabel] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Clear between openings, during render rather than in an effect, so a
  // previous attempt cannot leave its text (or its error) armed in the field.
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (!open) {
      setLabel('');
      setNote('');
      setError(null);
    }
  }

  const submit = async () => {
    const trimmed = label.trim();
    if (!trimmed) {
      setError(t('versions.nameRequired'));
      return;
    }
    setError(null);
    try {
      await onCreate(trimmed, note);
      onClose();
    } catch {
      // The global mutation handler already raised a toast with the real reason;
      // this only keeps the modal open so the typed name is not lost.
      setError(t('versions.createFailed'));
    }
  };

  return (
    <Modal
      open={open}
      title={t('versions.modalTitle')}
      icon={GitBranch}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => void submit()} disabled={isPending}>
            {isPending ? t('versions.creating') : t('versions.create')}
          </Button>
        </>
      }
    >
      <p className="text-muted-foreground">{t('versions.modalDescription')}</p>

      <div className="mt-4 space-y-4">
        <Field label={t('versions.newLabel')} htmlFor="version-name" error={error ?? undefined}>
          <Input
            id="version-name"
            value={label}
            autoFocus
            autoComplete="off"
            placeholder={t('versions.labelPlaceholder')}
            onChange={(event) => {
              setLabel(event.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void submit();
            }}
          />
          <p className="text-muted-foreground mt-1 text-xs">{t('versions.nameHint')}</p>
        </Field>

        <Field label={t('versions.note')} htmlFor="version-note">
          <Textarea
            id="version-note"
            rows={2}
            value={note}
            placeholder={t('versions.notePlaceholder')}
            onChange={(event) => setNote(event.target.value)}
          />
        </Field>
      </div>
    </Modal>
  );
}
