'use client';

import { Save } from 'lucide-react';
import { useState } from 'react';

import { useI18n } from '@/core/i18n';
import { ScreenHeader } from '@/shared/components';
import { Button, Card, CardBody, Tabs } from '@/shared/ui';

import { VersionListPanel } from '@/features/documents';

import { useProject } from '../hooks/use-projects';
import { projectRoutes } from '../routes';

import { ProjectAvatar } from './project-avatar';

import { MemberTable } from './member-table';
import { ProjectInfoPanel } from './project-info-panel';
import { ProjectSettingsPanel } from './project-settings-panel';

type TabValue = 'info' | 'members' | 'settings' | 'versions';

const INFO_FORM_ID = 'project-info-form';

/**
 * "Quản lý project" screen. The header's save button submits the info form via
 * `form=` — that is why `ProjectInfoPanel` takes a form id instead of rendering
 * its own submit button.
 */
export function ProjectSettingsScreen({ projectId }: { projectId: string }) {
  const { t } = useI18n();
  const { data: project } = useProject(projectId);
  const [tab, setTab] = useState<TabValue>('info');

  return (
    <>
      <Card>
        <ScreenHeader
          title={t('projectAdmin.title')}
          backHref={projectRoutes.list}
          subtitle={
            <>
              <ProjectAvatar imageUrl={project?.imageUrl} size="sm" />
              {project?.name}
            </>
          }
          action={
            tab === 'info' && (
              <Button type="submit" form={INFO_FORM_ID}>
                <Save aria-hidden />
                {t('common.save')}
              </Button>
            )
          }
        />

        <Tabs
          value={tab}
          onValueChange={setTab}
          items={[
            { value: 'info', label: t('projectAdmin.tab.info') },
            { value: 'members', label: t('projectAdmin.tab.members') },
            { value: 'settings', label: t('projectAdmin.tab.settings') },
            { value: 'versions', label: t('versions.tab') },
          ]}
        />

        <CardBody>
          {tab === 'info' && <ProjectInfoPanel projectId={projectId} formId={INFO_FORM_ID} />}
          {tab === 'members' && <MemberTable projectId={projectId} />}
          {tab === 'settings' && <ProjectSettingsPanel projectId={projectId} />}
          {tab === 'versions' && <VersionListPanel projectId={projectId} />}
        </CardBody>
      </Card>

      <p className="text-muted-foreground mt-3 text-center text-xs">{t('projectAdmin.footnote')}</p>
    </>
  );
}
