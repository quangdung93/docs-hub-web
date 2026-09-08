'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Circle, GitBranch, Plus } from 'lucide-react';

import { useI18n } from '@/core/i18n';
import { formatDate } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';

import { type ProjectVersionDto } from '../api/document.dto';

/**
 * Which project version the document list is showing, as a pill beside the
 * project name.
 *
 * Distinct from the format/status filters below it: those narrow a list, this
 * changes which snapshot of the project you are looking at — closer to a branch
 * selector than a filter. It sits in the header for that reason.
 *
 * `value` of null means the newest version, which is also the editable one.
 */
export function VersionPickerPill({
  versions,
  value,
  onChange,
  onCreate,
}: {
  /** Newest first; the first entry is treated as current. */
  versions: ProjectVersionDto[];
  value: string | null;
  onChange: (versionId: string | null) => void;
  onCreate: () => void;
}) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Dismiss on an outside click or Escape, scoped to the container so choosing
  // a version inside the menu does not close it before the click registers.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const latest = versions[0];
  if (!latest) return null;

  const active = versions.find((version) => version.id === value) ?? latest;
  const isLatest = active.id === latest.id;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="border-border bg-surface-muted hover:bg-accent inline-flex h-6 items-center gap-1 rounded-full border pr-1.5 pl-2 text-xs font-medium transition-colors"
      >
        <GitBranch className="size-3" aria-hidden />
        {active.label}
        {isLatest && ` · ${t('versions.pillLatest')}`}
        <ChevronDown className="size-3" aria-hidden />
      </button>

      {open && (
        <div
          role="menu"
          className="border-border bg-surface absolute top-8 left-0 z-30 w-72 rounded-lg border p-1.5 shadow-lg"
        >
          <p className="text-muted-foreground px-2 py-1 text-[11px] font-semibold tracking-wide uppercase">
            {t('versions.pickerTitle')}
          </p>

          {versions.map((version) => {
            const current = version.id === latest.id;
            return (
              <button
                key={version.id}
                type="button"
                role="menuitem"
                onClick={() => {
                  // Null for the newest, so "latest" keeps following the newest
                  // version rather than pinning to whichever id is newest today.
                  onChange(current ? null : version.id);
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                  version.id === active.id ? 'bg-brand-subtle' : 'hover:bg-accent'
                )}
              >
                <span className="flex min-w-0 items-center gap-2">
                  {current ? (
                    <Check className="text-status-indexed size-3.5 shrink-0" aria-hidden />
                  ) : (
                    <Circle className="text-muted-foreground/40 size-3.5 shrink-0" aria-hidden />
                  )}
                  <span className="truncate font-medium">{version.label}</span>
                </span>
                <span className="text-muted-foreground shrink-0 text-xs">
                  {formatDate(version.created_at, locale)}
                </span>
              </button>
            );
          })}

          <div className="border-border mt-1 border-t pt-1">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onCreate();
              }}
              className="text-brand hover:bg-brand-subtle/60 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-medium transition-colors"
            >
              <Plus className="size-3.5" aria-hidden />
              {t('versions.createNew')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
