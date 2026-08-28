'use client';

import { ArrowLeft, CircleDot, Filter, GitBranch, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { type MessageKey, useI18n } from '@/core/i18n';
import { orUnknown } from '@/shared/lib/format';
import { ProjectAvatar, useProject } from '@/features/projects';
import { projectRoutes } from '@/features/projects/routes';
import { Button, IconButton, SearchInput, Select, Tabs } from '@/shared/ui';

import { useVersionLabels } from '../hooks/use-documents';
import {
  DOCUMENT_FORMAT_VALUES,
  type DocumentFormat,
  type DocumentStatus,
} from '../schemas/document.schema';

import { DocumentHistoryList } from './document-history-list';
import { DocumentTable } from './document-table';
import { ExportReportMenu } from './export-report-menu';

const STATUS_VALUES = ['indexed', 'processing', 'queued', 'failed'] as const;

type Pane = 'files' | 'history';

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
  const [versionFilter, setVersionFilter] = useState<string>('all');

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

  // Newest version first, matching how the settings tab lists them.
  const versionOptions = [
    { value: 'all', label: t('versions.filterAll') },
    ...[...versions]
      .sort((a, b) => b.sequence_no - a.sequence_no)
      .map((version) => ({ value: version.id, label: version.label })),
  ];

  return (
    <main className="flex-1 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <IconButton
            icon={ArrowLeft}
            label={t('common.back')}
            className="border-border size-9 border"
            onClick={() => router.push(projectRoutes.list)}
          />
          <div>
            <h1 className="text-lg font-semibold tracking-tight">{t('documents.title')}</h1>
            <p className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-sm">
              <ProjectAvatar imageUrl={project?.imageUrl} size="sm" />
              {project?.name}
              {project && ` · ${t('documents.count', { count: orUnknown(project.documentCount) })}`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ExportReportMenu projectId={projectId} />
          <Button asChild>
            <Link href={projectRoutes.upload(projectId)}>
              <Plus aria-hidden />
              {t('documents.upload')}
            </Link>
          </Button>
        </div>
      </div>

      <Tabs
        className="mt-4 px-0"
        value={pane}
        onValueChange={setPane}
        items={[
          { value: 'files', label: t('history.documentsTab') },
          { value: 'history', label: t('history.tab') },
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

            {/* Only worth showing once a project has more than one version —
                a single-version project has nothing to choose between. */}
            {versions.length > 1 && (
              <Select
                value={versionFilter}
                onValueChange={setVersionFilter}
                options={versionOptions}
                label={t('versions.filterLabel')}
                icon={GitBranch}
              />
            )}
          </div>

          <DocumentTable
            projectId={projectId}
            search={search}
            formatFilter={formatFilter}
            statusFilter={statusFilter}
            versionFilter={versionFilter}
          />
        </>
      ) : (
        <div className="mt-4">
          <DocumentHistoryList projectId={projectId} />
        </div>
      )}
    </main>
  );
}
