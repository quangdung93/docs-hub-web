'use client';

import { useState } from 'react';
import { GitCommitHorizontal, Plus } from 'lucide-react';

import { useI18n } from '@/core/i18n';
import { formatDate } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { Badge, Button, ErrorState, Skeleton } from '@/shared/ui';

import { useCreateProjectVersion, useDocuments, useProjectVersions } from '../hooks/use-documents';

import { CreateVersionModal } from './create-version-modal';

/**
 * Project versions, newest first, with the control that creates one.
 *
 * Deliberately read-and-create only. The mockup also offers "restore" and
 * "delete" per version, but docs-hub-api exposes neither (`DELETE .../versions/{id}`
 * and `.../restore` both 404, verified 28/08/2026) — a button that cannot work is
 * worse than no button, so they are absent rather than disabled-with-a-tooltip.
 */
export function VersionListPanel({ projectId }: { projectId: string }) {
  const { t, locale } = useI18n();
  const { data: versions, isPending, isError, error, refetch } = useProjectVersions(projectId);
  const { data: documents } = useDocuments(projectId);
  const createVersion = useCreateProjectVersion(projectId);
  const [modalOpen, setModalOpen] = useState(false);

  // Newest first: the backend returns ascending `sequence_no`, and the version a
  // user cares about is almost always the one they just made.
  const ordered = [...(versions ?? [])].sort((a, b) => b.sequence_no - a.sequence_no);
  const latestId = ordered[0]?.id;

  /** How many documents currently sit in a version — from data already loaded. */
  const countIn = (versionId: string) =>
    (documents ?? []).filter((document) => document.projectVersionId === versionId).length;

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">{t('versions.sectionTitle')}</h2>
          <p className="text-muted-foreground mt-0.5 text-xs">{t('versions.sectionHint')}</p>
        </div>
        <Button size="sm" onClick={() => setModalOpen(true)}>
          <Plus aria-hidden />
          {t('versions.createNew')}
        </Button>
      </div>

      <div className="mt-3 space-y-2">
        {isPending &&
          Array.from({ length: 2 }, (_, index) => <Skeleton key={index} className="h-14" />)}

        {isError && (
          <ErrorState
            error={error}
            title={t('versions.loadError')}
            fallbackMessage={t('error.loadFailed')}
            retryLabel={t('common.retry')}
            onRetry={() => void refetch()}
            className="py-6"
          />
        )}

        {!isPending && !isError && ordered.length === 0 && (
          <p className="text-muted-foreground py-6 text-center text-sm">{t('versions.empty')}</p>
        )}

        {!isPending &&
          !isError &&
          ordered.map((version) => {
            const isLatest = version.id === latestId;
            return (
              <div
                key={version.id}
                className={cn(
                  'flex items-center justify-between gap-3 rounded-lg border p-3',
                  isLatest ? 'border-brand/40 bg-brand-subtle/40' : 'border-border'
                )}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={cn(
                      'grid size-8 shrink-0 place-items-center rounded-full',
                      isLatest ? 'bg-brand text-white' : 'bg-surface-muted text-muted-foreground'
                    )}
                  >
                    <GitCommitHorizontal className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0 leading-tight">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate font-medium">{version.label}</span>
                      {isLatest && (
                        <Badge variant="indexed" className="shrink-0">
                          {t('versions.current')}
                        </Badge>
                      )}
                    </div>
                    <div className="text-muted-foreground mt-0.5 text-xs">
                      {formatDate(version.created_at, locale)} ·{' '}
                      {t('versions.documentCount', { count: countIn(version.id) })}
                    </div>
                  </div>
                </div>

                <Badge variant="neutral" className="shrink-0">
                  {version.status === 'draft'
                    ? t('versions.status.draft')
                    : t('versions.status.released')}
                </Badge>
              </div>
            );
          })}
      </div>

      <CreateVersionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreate={(label, note) => createVersion.mutateAsync({ label, note })}
        isPending={createVersion.isPending}
      />
    </section>
  );
}
