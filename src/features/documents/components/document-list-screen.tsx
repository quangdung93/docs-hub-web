'use client';

import { ArrowLeft, CircleDot, Filter, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { type MessageKey, useI18n } from '@/core/i18n';
import { orUnknown } from '@/shared/lib/format';
import { ProjectAvatar, useProject } from '@/features/projects';
import { projectRoutes } from '@/features/projects/routes';
import { Button, IconButton, SearchInput, Select } from '@/shared/ui';

import {
  DOCUMENT_FORMAT_VALUES,
  type DocumentFormat,
  type DocumentStatus,
} from '../schemas/document.schema';

import { DocumentTable } from './document-table';

const STATUS_VALUES = ['indexed', 'processing', 'queued', 'failed'] as const;

/**
 * "Quản lý dự án" screen — header, filter bar and the document table. Owns the
 * search/filter state and passes it down, so `DocumentTable` stays reusable in
 * any other context that already knows its filters.
 */
export function DocumentListScreen({ projectId }: { projectId: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const { data: project } = useProject(projectId);
  const [search, setSearch] = useState('');
  const [formatFilter, setFormatFilter] = useState<DocumentFormat | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<DocumentStatus | 'all'>('all');

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

        <Button asChild>
          <Link href={projectRoutes.upload(projectId)}>
            <Plus aria-hidden />
            {t('documents.upload')}
          </Link>
        </Button>
      </div>

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
      />
    </main>
  );
}
