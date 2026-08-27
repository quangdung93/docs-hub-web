'use client';

import { useI18n } from '@/core/i18n';
import { Dropzone } from '@/shared/ui';

import { useUploadQueue } from '../hooks/use-upload-queue';
import { ACCEPT_ATTRIBUTE } from '../schemas/document.schema';

import { UploadQueueItem } from './upload-queue-item';
import { VersionPicker } from './version-picker';

/**
 * Dropzone + processing queue. Shared verbatim by the upload screen and step 2 of
 * the create-project wizard; `layout` only decides whether the queue sits beside
 * the dropzone (upload screen) or below it (wizard).
 */
export function UploadPanel({
  projectId,
  layout = 'split',
}: {
  projectId: string;
  layout?: 'split' | 'stacked';
}) {
  const { t } = useI18n();
  const {
    items,
    addFiles,
    removeItem,
    markSettled,
    progress,
    draftVersions,
    targetVersionId,
    selectVersion,
    addVersion,
    isAddingVersion,
  } = useUploadQueue(projectId);

  // Above the dropzone on purpose: an upload with no version is refused, so the
  // choice has to be visible before a file is dropped, not after it fails.
  const versionPicker = (
    <VersionPicker
      versions={draftVersions}
      value={targetVersionId}
      onChange={selectVersion}
      onCreate={addVersion}
      isCreating={isAddingVersion}
    />
  );

  const dropzone = (
    <Dropzone
      onFilesSelected={addFiles}
      accept={ACCEPT_ATTRIBUTE}
      title={t('upload.dropzone.title')}
      orLabel={t('upload.dropzone.or')}
      browseLabel={t('upload.dropzone.browse')}
      fromDeviceLabel={t('upload.dropzone.fromDevice')}
      hint={t('upload.dropzone.hint')}
      className={layout === 'split' ? 'min-h-[280px]' : 'min-h-[220px]'}
    />
  );

  const queue = (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          {t('upload.queue.title')}
        </span>
        {progress.total > 0 && (
          <span className="text-muted-foreground text-xs">
            {t('upload.queue.progress', { done: progress.done, total: progress.total })}
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <p className="border-border text-muted-foreground rounded-lg border border-dashed px-4 py-6 text-center text-sm">
          {t('upload.queue.empty')}
        </p>
      ) : (
        <ul className="space-y-2.5">
          {items.map((item) => (
            <UploadQueueItem
              key={item.id}
              item={item}
              projectId={projectId}
              onRemove={removeItem}
              onSettled={markSettled}
            />
          ))}
        </ul>
      )}
    </div>
  );

  if (layout === 'stacked') {
    return (
      <div className="space-y-4">
        {versionPicker}
        {dropzone}
        {items.length > 0 && queue}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {versionPicker}
      <div className="grid gap-6 lg:grid-cols-2">
        {dropzone}
        {queue}
      </div>
    </div>
  );
}
