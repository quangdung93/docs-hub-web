'use client';

import { ArrowLeft, CircleDot, Filter, History, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { type MessageKey, useI18n } from '@/core/i18n';
import { orUnknown } from '@/shared/lib/format';
import { ProjectAvatar, useProject } from '@/features/projects';
import { projectRoutes } from '@/features/projects/routes';
import { Button, IconButton, SearchInput, Select, Tabs } from '@/shared/ui';

import { useCreateProjectVersion, useVersionLabels } from '../hooks/use-documents';
import {
  DOCUMENT_FORMAT_VALUES,
  type DocumentFormat,
  type DocumentStatus,
} from '../schemas/document.schema';

import { CompletenessList } from './completeness-list';
import { CreateVersionModal } from './create-version-modal';
import { DocumentHistoryList } from './document-history-list';
import { DocumentTable } from './document-table';
import { ExportReportMenu } from './export-report-menu';
import { VersionPickerPill } from './version-picker-pill';

const STATUS_VALUES = ['indexed', 'processing', 'queued', 'failed'] as const;

type Pane = 'files' | 'history' | 'completeness';

/**
 * "Quản lý dự án" screen — header, filter bar and the document table. Owns the
 * search/filter state and passes it down, so `DocumentTable` stays reusable in
 * any other context that already knows its filters.
 */
export function DocumentListScreen({ projectId }: { projectId: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const { data: project } = useProject(projectId);
  const { versions } = useVersionLabels(projectId);
  const [pane, setPane] = useState<Pane>('files');
  const [search, setSearch] = useState('');
  const [formatFilter, setFormatFilter] = useState<DocumentFormat | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<DocumentStatus | 'all'>('all');
  /** Which snapshot the list shows. Null means the newest, the only editable one. */
  const [viewingVersion, setViewingVersion] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const createVersion = useCreateProjectVersion(projectId);

  const formatOptions = [
    { value: 'all' as const, label: t('documents.filter.allFormats') },
    ...DOCUMENT_FORMAT_VALUES.map((value) => ({
      value,
      label: t(`documents.format.${value}` as MessageKey),
    })),
  ];

  const statusOptions = [
    { value: 'all' as const, label: t('documents.filter.all') },
    ...STATUS_VALUES.map((value) => ({ value, label: t(`docStatus.${value}`) })),
  ];

  // Newest first, so `[0]` is the current version everywhere below.
  const orderedVersions = [...versions].sort((a, b) => b.sequence_no - a.sequence_no);

  // Older snapshots are read-only: an upload always lands in a draft version,
  // so offering the button while viewing history would either fail or write to
  // a version the user is not looking at.
  const isReadOnly = viewingVersion !== null && viewingVersion !== orderedVersions[0]?.id;
  const viewedLabel = orderedVersions.find((version) => version.id === viewingVersion)?.label;

  return (
    <main className="flex-1 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* Back goes to the project's chat, not the project list: this screen
              is only reachable from there (and from the versions tab, which is
              itself one step further in), so the list is two steps back. */}
          <IconButton
            icon={ArrowLeft}
            label={t('common.back')}
            className="border-border size-9 border"
            onClick={() => router.push(projectRoutes.chat(projectId))}
          />
          <div>
            <h1 className="text-lg font-semibold tracking-tight">{t('documents.title')}</h1>
            <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-2 text-sm">
              <span className="flex items-center gap-1.5">
                <ProjectAvatar imageUrl={project?.imageUrl} size="sm" />
                {project?.name}
                {project &&
                  ` · ${t('documents.count', { count: orUnknown(project.documentCount) })}`}
              </span>
              <VersionPickerPill
                versions={orderedVersions}
                value={viewingVersion}
                onChange={setViewingVersion}
                onCreate={() => setCreateOpen(true)}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ExportReportMenu projectId={projectId} />
          {isReadOnly ? (
            <Button disabled title={t('versions.readOnlyUpload')}>
              <Plus aria-hidden />
              {t('documents.upload')}
            </Button>
          ) : (
            <Button asChild>
              <Link href={projectRoutes.upload(projectId)}>
                <Plus aria-hidden />
                {t('documents.upload')}
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Says plainly that this is a past snapshot. Without it the disabled
          upload button and the shorter list read as bugs. */}
      {isReadOnly && (
        <div className="border-status-queued/40 bg-status-queued-bg/60 text-status-queued mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3.5 py-2.5 text-sm">
          <span className="flex items-center gap-2">
            <History className="size-4 shrink-0" aria-hidden />
            {t('versions.readOnlyBanner', { label: viewedLabel ?? '' })}
          </span>
          <Button variant="outline" size="sm" onClick={() => setViewingVersion(null)}>
            {t('versions.backToLatest')}
          </Button>
        </div>
      )}

      <Tabs
        className="mt-4 px-0"
        value={pane}
        onValueChange={setPane}
        items={[
          { value: 'files', label: t('history.documentsTab') },
          { value: 'history', label: t('history.tab') },
          { value: 'completeness', label: t('completeness.tab') },
        ]}
      />

      {pane === 'files' ? (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <SearchInput
              className="w-80 max-w-full"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('documents.searchPlaceholder')}
              aria-label={t('documents.searchPlaceholder')}
            />

            <Select
              value={formatFilter}
              onValueChange={setFormatFilter}
              options={formatOptions}
              label={t('documents.filter.format')}
              icon={Filter}
            />

            <Select
              value={statusFilter}
              onValueChange={setStatusFilter}
              options={statusOptions}
              label={t('documents.filter.statusLabel')}
              icon={CircleDot}
            />
          </div>

          <DocumentTable
            projectId={projectId}
            search={search}
            formatFilter={formatFilter}
            statusFilter={statusFilter}
            // Driven by the pill in the header, which replaced a duplicate
            // dropdown here — two controls for one thing meant changing the
            // wrong one had no visible effect.
            versionFilter={viewingVersion ?? 'all'}
          />
        </>
      ) : pane === 'history' ? (
        <div className="mt-4">
          <DocumentHistoryList projectId={projectId} />
        </div>
      ) : (
        <div className="mt-4">
          <CompletenessList projectId={projectId} />
        </div>
      )}

      <CreateVersionModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={(label, note) => createVersion.mutateAsync({ label, note })}
        isPending={createVersion.isPending}
      />
    </main>
  );
}
