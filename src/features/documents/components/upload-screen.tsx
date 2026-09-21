'use client';

import { ArrowRight, Folder, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

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
  /** Phiên bản các tệp đang được tải vào, do panel báo lên. */
  const [targetVersionId, setTargetVersionId] = useState<string | undefined>();
  // Bọc trong useCallback để panel không chạy lại effect mỗi lần màn hình render.
  const handleVersionChange = useCallback((id: string | undefined) => setTargetVersionId(id), []);

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
        <UploadPanel projectId={projectId} onVersionChange={handleVersionChange} />
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
          {/* Về lại Quản lý tài liệu, không phải màn hỏi đáp: vừa tải tài liệu
              lên thì việc tiếp theo là xem nó đã vào đúng chỗ chưa. Kèm theo
              phiên bản vừa chọn để danh sách không rơi về bản mới nhất. */}
          <Button onClick={() => router.push(projectRoutes.documents(projectId, targetVersionId))}>
            {t('common.done')}
            <ArrowRight aria-hidden />
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
