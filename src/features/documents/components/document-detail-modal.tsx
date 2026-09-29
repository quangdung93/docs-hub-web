'use client';

import { useState } from 'react';
import { Download, FileText, RotateCcw } from 'lucide-react';

import { useI18n } from '@/core/i18n';
import { formatRelativeTime } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import {
  Badge,
  FileTypeIcon,
  IconButton,
  Modal,
  PendingActionDialogs,
  Tabs,
  usePendingAction,
} from '@/shared/ui';

import { documentsApi } from '../api/documents.api';
import { useVersionLabels } from '../hooks/use-documents';
import { formatBytes } from '../services/upload-queue.service';
import { type Document } from '../schemas/document.schema';

import { DocumentStatusBadge } from './document-status-badge';

/**
 * One document's details and its full revision history.
 *
 * Everything here comes from the row already in cache — the list fetches each
 * document's detail to fill in its columns, and that response carries every
 * revision. So opening this costs no request.
 *
 * Two things the mockup shows are not in any response: the chunk count and the
 * uploader's name (revisions carry a `created_by` **id**, and there is no
 * endpoint to resolve one to a name). Their rows are rendered but marked as not
 * yet provided, rather than filled with a plausible-looking number — a fake
 * "148 chunks" next to a real file size is indistinguishable from a real one.
 */
export function DocumentDetailModal({
  projectId,
  document,
  onClose,
  initialTab = 'info',
}: {
  projectId: string;
  document: Document | null;
  onClose: () => void;
  initialTab?: 'info' | 'history';
}) {
  const { t, locale } = useI18n();
  const { labelOf } = useVersionLabels(projectId);
  const [tab, setTab] = useState<'info' | 'history'>(initialTab);
  const pending = usePendingAction();

  // Reset to the requested tab each time a different document is opened, during
  // render rather than in an effect so the modal never flashes the previous one.
  const [lastId, setLastId] = useState(document?.id ?? null);
  if (document && document.id !== lastId) {
    setLastId(document.id);
    setTab(initialTab);
  }

  if (!document) return null;

  return (
    <>
      <Modal
        open
        title={document.name}
        icon={FileText}
        onClose={onClose}
        className="w-[min(42rem,calc(100vw-2rem))]"
      >
        <Tabs
          className="-mx-5 -mt-4 mb-4 px-5"
          value={tab}
          onValueChange={setTab}
          items={[
            { value: 'info', label: t('documentDetail.infoTab') },
            { value: 'history', label: t('history.tab') },
          ]}
        />

        {tab === 'info' ? (
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
            <Fact label={t('documentDetail.size')}>{formatBytes(document.sizeBytes)}</Fact>
            <Fact label={t('documentDetail.chunks')} missing={document.chunkCount === null}>
              {document.chunkCount ?? t('documentDetail.notAvailable')}
            </Fact>
            <Fact label={t('documentDetail.updated')}>
              {formatRelativeTime(document.updatedAt, locale)}
            </Fact>
            <Fact label={t('documentDetail.status')}>
              <DocumentStatusBadge status={document.status} />
            </Fact>
            <Fact label={t('documentDetail.currentVersion')}>
              {document.revisionNo === null
                ? t('common.emptyValue')
                : t('history.revision', { no: document.revisionNo })}
            </Fact>
            <Fact
              label={t('documentDetail.projectVersion')}
              missing={document.projectVersionId === null}
            >
              {labelOf(document.projectVersionId) ?? t('common.emptyValue')}
            </Fact>
            {/* Revisions carry `created_by` as an id and nothing resolves it to
                a name, so this stays empty rather than showing a raw UUID. */}
            <Fact label={t('documentDetail.uploader')} missing>
              {t('documentDetail.notAvailable')}
            </Fact>
          </dl>
        ) : (
          <div className="space-y-2.5">
            <p className="text-muted-foreground text-xs">{t('documentDetail.historyHint')}</p>

            {document.history.map((revision) => {
              const isCurrent = revision.id === document.revisionId;
              return (
                <div
                  key={revision.id}
                  className={cn(
                    'flex items-center justify-between gap-3 rounded-lg border p-3',
                    isCurrent ? 'border-brand/40 bg-brand-subtle/40' : 'border-border'
                  )}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <FileTypeIcon fileName={revision.fileName} />
                    <div className="min-w-0 leading-tight">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium">
                          {t('history.revision', { no: revision.revisionNo })}
                        </span>
                        {isCurrent && <Badge variant="indexed">{t('versions.current')}</Badge>}
                      </div>
                      <div className="text-muted-foreground mt-0.5 text-xs">
                        {formatRelativeTime(revision.uploadedAt, locale)} ·{' '}
                        {formatBytes(revision.sizeBytes)}
                        {labelOf(revision.projectVersionId) &&
                          ` · ${labelOf(revision.projectVersionId)}`}
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    {/* A plain link: the response sets Content-Disposition, so
                        the browser saves it with the right name on its own. */}
                    <a
                      href={documentsApi.downloadUrl(projectId, document.id, revision.id)}
                      download
                      aria-label={t('documents.action.download')}
                      className="text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring/40 inline-flex size-8 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none"
                    >
                      <Download className="size-4" aria-hidden />
                    </a>

                    {/* No endpoint promotes an older revision to current, so this
                        asks the real question and then says so. */}
                    {!isCurrent && (
                      <IconButton
                        icon={RotateCcw}
                        size="sm"
                        label={t('documentDetail.restore')}
                        onClick={() =>
                          pending.request(
                            t('documentDetail.restore'),
                            t('documentDetail.restoreConfirm', {
                              name: document.name,
                              no: revision.revisionNo,
                            })
                          )
                        }
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Modal>

      <PendingActionDialogs
        state={pending}
        confirmLabel={t('common.continue')}
        cancelLabel={t('common.cancel')}
        doneLabel={t('common.done')}
        noticeDescription={t('common.comingSoon')}
      />
    </>
  );
}

/** One label/value pair; `missing` greys the value out as awaiting the backend. */
function Fact({
  label,
  missing,
  children,
}: {
  label: string;
  missing?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd
        className={cn(
          'mt-0.5 font-medium',
          missing && 'text-muted-foreground/70 font-normal italic'
        )}
      >
        {children}
      </dd>
    </div>
  );
}
