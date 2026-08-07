'use client';

import { FolderOpen, Plus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { useI18n } from '@/core/i18n';
import { Button, EmptyState, SearchInput, Skeleton } from '@/shared/ui';

import { useProjects } from '../hooks/use-projects';
import { projectRoutes } from '../routes';

import { ProjectCard } from './project-card';

/**
 * Project picker. Search is client-side filtering over the loaded page — the
 * dataset is small and per-user, so a round trip per keystroke buys nothing.
 * Swap in the server-side `search` param (already supported by `projectsApi.list`
 * and `useProjects`) if a tenant ever grows past a page of projects.
 */
export function ProjectGrid() {
  const { t } = useI18n();
  const [search, setSearch] = useState('');
  const { data: projects, isPending, isError } = useProjects();

  const query = search.trim().toLowerCase();
  const visible = query
    ? (projects ?? []).filter(
        (project) =>
          project.name.toLowerCase().includes(query) ||
          project.description.toLowerCase().includes(query)
      )
    : (projects ?? []);

  return (
    <main className="flex-1 p-6 lg:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">{t('projects.title')}</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">{t('projects.subtitle')}</p>
        </div>
        <Button asChild>
          <Link href={projectRoutes.create}>
            <Plus aria-hidden />
            {t('projects.create')}
          </Link>
        </Button>
      </div>

      <SearchInput
        className="mt-4 max-w-md"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={t('projects.searchPlaceholder')}
        aria-label={t('projects.searchPlaceholder')}
      />

      {isPending && (
        <div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-[168px] rounded-xl" />
          ))}
        </div>
      )}

      {isError && <EmptyState icon={FolderOpen} title={t('projects.loadError')} className="mt-5" />}

      {!isPending && !isError && visible.length === 0 && (
        <EmptyState
          icon={FolderOpen}
          title={query ? t('projects.emptySearch') : t('projects.empty')}
          className="mt-5"
          action={
            !query && (
              <Button asChild>
                <Link href={projectRoutes.create}>
                  <Plus aria-hidden />
                  {t('projects.create')}
                </Link>
              </Button>
            )
          }
        />
      )}

      {!isPending && !isError && visible.length > 0 && (
        <div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {visible.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}

          <Link
            href={projectRoutes.create}
            className="border-input text-muted-foreground hover:border-brand/50 hover:text-brand focus-visible:ring-ring/40 grid min-h-[168px] place-items-center rounded-xl border border-dashed p-5 transition focus-visible:ring-2 focus-visible:outline-none"
          >
            <span className="text-center">
              <Plus className="mx-auto size-6" aria-hidden />
              <span className="mt-1 block text-sm font-medium">{t('projects.createNew')}</span>
            </span>
          </Link>
        </div>
      )}
    </main>
  );
}
