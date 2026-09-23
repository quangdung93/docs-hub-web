'use client';

import { useEffect } from 'react';

import { useI18n } from '@/core/i18n';
import { Dropzone, Field, Input } from '@/shared/ui';

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
  initialVersion = false,
  onVersionChange,
  customDocumentVersion = false,
}: {
  projectId: string;
  layout?: 'split' | 'stacked';
  /** Set by the create-project wizard: the version named here is the first one. */
  initialVersion?: boolean;
  /**
   * Phiên bản mà các tệp sẽ vào. Màn hình bao ngoài cần biết để điều hướng về
   * đúng phiên bản đó khi người dùng bấm xong — lựa chọn này là state trong
   * hook, đi khỏi trang là mất.
   */
  onVersionChange?: (versionId: string | undefined) => void;
  /** Show the free-text revision version used by the document upload screen. */
  customDocumentVersion?: boolean;
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
    canUpload,
    documentVersion,
    setDocumentVersion,
  } = useUploadQueue(projectId);

  // Báo lên mỗi khi phiên bản đích đổi, kể cả lần đầu khi nó tự chọn bản mới nhất.
  useEffect(() => {
    onVersionChange?.(targetVersionId);
  }, [targetVersionId, onVersionChange]);

  // The upload API requires a project version scope. The document's own version
  // label is optional and independent from that scope.
  const versionPicker = customDocumentVersion ? (
    <>
      <Field label={t('upload.documentVersion')} htmlFor="document-version">
        <Input
          id="document-version"
          value={documentVersion}
          onChange={(event) => setDocumentVersion(event.target.value)}
          maxLength={255}
          placeholder={t('upload.documentVersionPlaceholder')}
        />
      </Field>
      {!draftVersions.length && (
        <VersionPicker
          versions={draftVersions}
          value={targetVersionId}
          onChange={selectVersion}
          onCreate={addVersion}
          isCreating={isAddingVersion}
        />
      )}
    </>
  ) : (
    <VersionPicker
      versions={draftVersions}
      value={targetVersionId}
      onChange={selectVersion}
      onCreate={addVersion}
      isCreating={isAddingVersion}
      initial={initialVersion}
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
      // Blocked until a version exists. The upload would be refused anyway —
      // scope is required — but failing a row after the file is already in the
      // queue tells the user too late, and reads as a bug rather than a
      // missing input.
      disabled={!canUpload}
      disabledHint={t('upload.dropzone.needVersion')}
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
