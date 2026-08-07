'use client';

import { FileText, Folder, Users } from 'lucide-react';
import Link from 'next/link';

import { useI18n } from '@/core/i18n';

import { projectRoutes } from '../routes';
import type { Project } from '../schemas/project.schema';

/**
 * Project tile in the picker grid. A real `<Link>` (the mockup used an onclick
 * div) so the card is keyboard-focusable and openable in a new tab.
 */
export function ProjectCard({ project }: { project: Project }) {
  const { t } = useI18n();

  return (
    <Link
      href={projectRoutes.chat(project.id)}
      className="group border-border hover:border-brand/40 focus-visible:ring-ring/40 block min-h-[168px] rounded-xl border p-5 transition hover:shadow-sm focus-visible:ring-2 focus-visible:outline-none"
    >
      <div className="flex items-start justify-between">
        <span className="bg-brand-subtle text-brand grid size-11 place-items-center rounded-lg">
          <Folder className="size-5.5" aria-hidden />
        </span>
      </div>

      <h3 className="mt-3.5 text-base font-semibold tracking-tight">{project.name}</h3>
      <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">{project.description}</p>

      <div className="text-muted-foreground mt-3.5 flex items-center gap-4 text-xs">
        <span className="flex items-center gap-1">
          <FileText className="size-3.5" aria-hidden />
          {t('projects.documentCount', { count: project.documentCount })}
        </span>
        <span className="flex items-center gap-1">
          <Users className="size-3.5" aria-hidden />
          {t('projects.memberCount', { count: project.memberCount })}
        </span>
      </div>
    </Link>
  );
}
