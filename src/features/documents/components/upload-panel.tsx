'use client';

import { useEffect } from 'react';

import { useI18n } from '@/core/i18n';
import { ConfirmDialog, Dropzone, Field, Input } from '@/shared/ui';

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
    urdPrompt,
    confirmUrdPrompt,
    dismissUrdPrompt,
    isConfirmingUrd,
  } = useUploadQueue(projectId);

  const urdDialog = (
    <ConfirmDialog
      open={urdPrompt !== null}
      variant="question"
      title={t('upload.urdPrompt.title')}
      description={t('upload.urdPrompt.description', { name: urdPrompt?.fileName ?? '' })}
      confirmLabel={t('upload.urdPrompt.confirm')}
      cancelLabel={t('upload.urdPrompt.reject')}
      onConfirm={() => void confirmUrdPrompt()}
      onCancel={dismissUrdPrompt}
      pending={isConfirmingUrd}
    />
  );

  // Báo lên mỗi khi phiên bản đích đổi, kể cả lần đầu khi nó tự chọn bản mới nhất.
  useEffect(() => {
    onVersionChange?.(targetVersionId);
  }, [targetVersionId, onVersionChange]);

  // Phiên bản tài liệu là bắt buộc ở màn tải tài liệu: chưa nhập thì chưa cho
  // thả file. Chặn ở dropzone chứ không đợi từng dòng hỏng sau khi đã vào hàng
  // đợi — báo lúc đó là quá muộn, và trông như lỗi hệ thống chứ không phải thiếu
  // thông tin. Phạm vi phiên bản project vẫn là chuyện riêng, độc lập với nhãn này.
  const needsDocumentVersion = customDocumentVersion && !documentVersion.trim();

  const versionPicker = customDocumentVersion ? (
    <>
      <Field label={t('upload.documentVersion')} htmlFor="document-version" required>
        <Input
          id="document-version"
          value={documentVersion}
          onChange={(event) => setDocumentVersion(event.target.value)}
          maxLength={255}
          required
          aria-required
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
      disabled={!canUpload || needsDocumentVersion}
      // Thiếu phiên bản project thì báo cái đó trước: đó là thứ người dùng không
      // tự gõ được ở đây, phải tạo phiên bản mới.
      disabledHint={
        !canUpload ? t('upload.dropzone.needVersion') : t('upload.dropzone.needDocumentVersion')
      }
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
        {urdDialog}
        {versionPicker}
        {dropzone}
        {items.length > 0 && queue}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {urdDialog}
      {versionPicker}
      <div className="grid gap-6 lg:grid-cols-2">
        {dropzone}
        {queue}
      </div>
    </div>
  );
}
