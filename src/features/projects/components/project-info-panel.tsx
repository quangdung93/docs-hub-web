'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, ChevronDown, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { type MessageKey, useI18n } from '@/core/i18n';
import { formatDate } from '@/shared/lib/format';
import { Avatar, Button, ConfirmDialog, Field, Input, Skeleton, Textarea } from '@/shared/ui';

import { useDeleteProject, useProject, useUpdateProject } from '../hooks/use-projects';
import { type UpdateProjectInput, UpdateProjectInputSchema } from '../schemas/project.schema';

/**
 * "Thông tin chung" tab — an editable form plus the read-only overview and the
 * delete zone. `formId` lets the screen's "Save changes" button (which lives in
 * the header, outside this form) submit it.
 */
export function ProjectInfoPanel({ projectId, formId }: { projectId: string; formId: string }) {
  const { t, locale } = useI18n();
  const { data: project, isPending } = useProject(projectId);
  const updateProject = useUpdateProject(projectId);
  const deleteProject = useDeleteProject(projectId);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdateProjectInput>({
    resolver: zodResolver(UpdateProjectInputSchema),
    mode: 'onTouched',
    // `values` (not defaultValues) so the form re-syncs once the query resolves.
    values: project
      ? { name: project.name, description: project.description, status: project.status }
      : undefined,
  });

  if (isPending || !project) {
    return (
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-72 lg:col-span-2" />
        <Skeleton className="h-72" />
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <form
        id={formId}
        onSubmit={handleSubmit((values) => updateProject.mutate(values))}
        className="space-y-4 lg:col-span-2"
        noValidate
      >
        <Field
          label={t('projectAdmin.name')}
          htmlFor="settings-name"
          error={errors.name && t(errors.name.message as MessageKey)}
        >
          <Input id="settings-name" aria-invalid={!!errors.name} {...register('name')} />
        </Field>

        <Field label={t('projectAdmin.description')} htmlFor="settings-description">
          <Textarea id="settings-description" rows={3} {...register('description')} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('projectAdmin.owner')}>
            <div className="border-input flex h-9 items-center gap-2 rounded-md border px-3 text-sm">
              <Avatar name={project.ownerName ?? project.ownerId} size="sm" />
              {project.ownerName ?? `#${project.ownerId.slice(0, 8)}`}
            </div>
          </Field>

          <Field label={t('projectAdmin.status')} htmlFor="settings-status">
            <div className="border-input relative flex h-9 items-center rounded-md border px-3 text-sm">
              <span
                className={`mr-2 size-2 rounded-full ${
                  project.status === 'active' ? 'bg-status-approved' : 'bg-status-archived'
                }`}
                aria-hidden
              />
              <select
                id="settings-status"
                className="w-full cursor-pointer appearance-none bg-transparent outline-none"
                {...register('status')}
              >
                <option value="active">{t('projectAdmin.status.active')}</option>
                <option value="archived">{t('projectAdmin.status.archived')}</option>
              </select>
              <ChevronDown
                className="text-muted-foreground pointer-events-none size-4"
                aria-hidden
              />
            </div>
          </Field>
        </div>
      </form>

      <div className="space-y-3">
        <section className="border-border rounded-xl border p-4">
          <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            {t('projectAdmin.overview')}
          </h3>
          <dl className="mt-3 space-y-2.5 text-sm">
            {(
              [
                [t('projectAdmin.overview.documents'), project.documentCount],
                [t('projectAdmin.overview.chunks'), project.chunkCount],
                [t('projectAdmin.overview.members'), project.memberCount],
                [t('projectAdmin.overview.createdAt'), formatDate(project.createdAt, locale)],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="flex items-center justify-between">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="border-status-failed/30 bg-status-failed-bg/50 rounded-xl border p-4">
          <h3 className="text-status-failed flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle className="size-4" aria-hidden />
            {t('projectAdmin.danger.title')}
          </h3>
          <p className="text-status-failed/80 mt-1.5 text-xs">
            {t('projectAdmin.danger.description')}
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={deleteProject.isPending}
            onClick={() => setConfirmingDelete(true)}
            className="border-status-failed/40 text-status-failed hover:bg-status-failed-bg mt-3"
          >
            <Trash2 aria-hidden />
            {t('projectAdmin.danger.delete')}
          </Button>
        </section>
      </div>

      <ConfirmDialog
        open={confirmingDelete}
        title={t('projectAdmin.danger.confirmTitle', { name: project.name })}
        description={t('projectAdmin.danger.confirmDescription')}
        confirmLabel={t('projectAdmin.danger.delete')}
        cancelLabel={t('common.cancel')}
        pending={deleteProject.isPending}
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={(typed) => deleteProject.mutate(typed)}
        confirmPhrase={project.name}
        confirmPhraseLabel={t('projectAdmin.danger.confirmNameLabel')}
      />
    </div>
  );
}
