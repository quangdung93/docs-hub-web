'use client';

import { useState } from 'react';
import { GitBranch, Plus } from 'lucide-react';

import { useI18n } from '@/core/i18n';
import { Button, Input, Select } from '@/shared/ui';

import { type ProjectVersionDto } from '../api/document.dto';

/**
 * Which version an upload lands in.
 *
 * Uploads are always scoped to a version and the backend rejects one that names
 * none, so this is not optional chrome: without it a project whose versions were
 * never created is a dead end, and a project with several gives no say in where
 * the file goes. Only drafts appear — a published version is frozen.
 */
export function VersionPicker({
  versions,
  value,
  onChange,
  onCreate,
  isCreating,
}: {
  versions: ProjectVersionDto[];
  value: string | undefined;
  onChange: (versionId: string) => void;
  onCreate: (label: string) => Promise<unknown>;
  isCreating: boolean;
}) {
  const { t } = useI18n();
  const [creating, setCreating] = useState(false);
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Nothing to pick from: the only useful control is the one that makes a
  // version, so open straight into it rather than showing an empty select.
  const empty = versions.length === 0;

  const submit = async () => {
    const trimmed = label.trim();
    if (!trimmed) return;
    setError(null);
    try {
      await onCreate(trimmed);
      setLabel('');
      setCreating(false);
    } catch {
      setError(t('versions.createFailed'));
    }
  };

  if (empty || creating) {
    return (
      <div className="border-border bg-surface-muted/40 space-y-2 rounded-lg border p-3">
        <label className="text-muted-foreground block text-xs font-medium" htmlFor="version-label">
          {empty ? t('versions.emptyPrompt') : t('versions.newLabel')}
        </label>
        <div className="flex gap-2">
          <Input
            id="version-label"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void submit();
            }}
            placeholder={t('versions.labelPlaceholder')}
            className="flex-1"
            disabled={isCreating}
          />
          <Button onClick={() => void submit()} disabled={isCreating || !label.trim()}>
            {isCreating ? t('versions.creating') : t('versions.create')}
          </Button>
          {!empty && (
            <Button variant="ghost" onClick={() => setCreating(false)} disabled={isCreating}>
              {t('common.cancel')}
            </Button>
          )}
        </div>
        {error && <p className="text-status-failed text-xs">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex items-end gap-2">
      <Select
        value={value ?? versions[0]!.id}
        onValueChange={onChange}
        options={versions.map((version) => ({
          value: version.id,
          label: version.label ?? version.id.slice(0, 8),
        }))}
        label={t('versions.selectLabel')}
        icon={GitBranch}
        className="flex-1"
      />
      <Button variant="ghost" onClick={() => setCreating(true)}>
        <Plus className="size-4" aria-hidden />
        {t('versions.new')}
      </Button>
    </div>
  );
}
