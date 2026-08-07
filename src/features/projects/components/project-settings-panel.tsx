'use client';

import { Cpu, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import type { ReactNode } from 'react';

import { useI18n } from '@/core/i18n';
import { Skeleton, Switch } from '@/shared/ui';

import { useProjectSettings, useUpdateProjectSettings } from '../hooks/use-projects';
import type { ProjectSettings } from '../schemas/project.schema';

/** Bordered settings group with an icon heading. */
function SettingsCard({
  icon: Icon,
  title,
  className,
  children,
}: {
  icon: typeof Cpu;
  title: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`border-border rounded-xl border p-4 ${className ?? ''}`}>
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Icon className="text-brand size-4" aria-hidden />
        {title}
      </h3>
      <div className="mt-3 space-y-3 text-sm">{children}</div>
    </section>
  );
}

/** Label + read-only chip row (models, chunk size, …). */
function ValueRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="border-border rounded-md border px-2.5 py-1 text-xs font-medium">
        {value}
      </span>
    </div>
  );
}

/**
 * "Cấu hình" tab. Toggles write through immediately (an optimistic local flip is
 * unnecessary — the mutation returns the new settings and seeds the cache).
 */
export function ProjectSettingsPanel({ projectId }: { projectId: string }) {
  const { t } = useI18n();
  const { data: settings, isPending } = useProjectSettings(projectId);
  const updateSettings = useUpdateProjectSettings(projectId);

  if (isPending || !settings) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-36 rounded-xl lg:col-span-2" />
      </div>
    );
  }

  const toggle = (key: keyof ProjectSettings) => (checked: boolean) =>
    updateSettings.mutate({ ...settings, [key]: checked });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <SettingsCard icon={Cpu} title={t('settings.model.title')}>
        <ValueRow label={t('settings.model.completion')} value={settings.completionModel} />
        <ValueRow label={t('settings.model.embedding')} value={settings.embeddingModel} />
        <ValueRow label={t('settings.model.topK')} value={settings.topK} />
      </SettingsCard>

      <SettingsCard icon={SlidersHorizontal} title={t('settings.processing.title')}>
        <ValueRow
          label={t('settings.processing.chunkSize')}
          value={t('settings.processing.tokens', { count: settings.chunkSize })}
        />
        <ValueRow
          label={t('settings.processing.overlap')}
          value={t('settings.processing.tokens', { count: settings.chunkOverlap })}
        />
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">{t('settings.processing.formats')}</span>
          <span className="text-muted-foreground text-xs">
            {settings.allowedFormats.join(' · ')}
          </span>
        </div>
      </SettingsCard>

      <SettingsCard
        icon={ShieldCheck}
        title={t('settings.security.title')}
        className="lg:col-span-2"
      >
        {(
          [
            ['auditLog', t('settings.security.auditLog')],
            ['membersOnly', t('settings.security.membersOnly')],
            ['allowExport', t('settings.security.allowExport')],
          ] as const
        ).map(([key, label]) => (
          <div key={key} className="flex items-center justify-between gap-3">
            <span>{label}</span>
            <Switch
              checked={settings[key]}
              onCheckedChange={toggle(key)}
              label={label}
              disabled={updateSettings.isPending}
            />
          </div>
        ))}
      </SettingsCard>
    </div>
  );
}
