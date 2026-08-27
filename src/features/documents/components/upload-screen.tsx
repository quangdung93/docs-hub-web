'use client';

import { ArrowRight, Folder, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { useI18n } from '@/core/i18n';
import { useProject } from '@/features/projects';
import { projectRoutes } from '@/features/projects/routes';
import { ScreenHeader } from '@/shared/components';
import { Button, Card, CardBody, CardFooter } from '@/shared/ui';

import { UploadPanel } from './upload-panel';

/** "Tải dữ liệu" screen — dropzone and processing queue side by side. */
export function UploadScreen({ projectId }: { projectId: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const { data: project } = useProject(projectId);

  return (
    <Card>
      <ScreenHeader
        title={t('upload.title')}
        backHref={projectRoutes.documents(projectId)}
        subtitle={
          <>
            <Folder className="size-3.5" aria-hidden />
            {project?.name}
          </>
        }
      />

      <CardBody>
        <UploadPanel projectId={projectId} />
      </CardBody>

      <CardFooter>
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <ShieldCheck className="size-3.5" aria-hidden />
          {t('upload.security')}
        </p>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => router.push(projectRoutes.documents(projectId))}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => router.push(projectRoutes.chat(projectId))}>
            {t('common.done')}
            <ArrowRight aria-hidden />
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
