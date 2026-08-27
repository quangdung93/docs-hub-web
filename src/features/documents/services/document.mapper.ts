import { type Document, type DocumentStatus } from '../schemas/document.schema';
import type { DocumentDto, RevisionDto } from '../api/document.dto';

/**
 * Wire DTO → domain model.
 *
 * The backend splits what the UI shows as one row across two records: the
 * document (title, description, optimistic-lock version) and its revisions
 * (file name, size, MIME type, ingestion status). The table renders one row per
 * document showing the **newest** revision, so that is what this flattens to.
 */

/** MIME type → the short label shown in the "Định dạng" column. */
const MEDIA_TYPE_LABELS: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel',
  'text/markdown': 'Markdown',
  'text/csv': 'CSV',
  'text/plain': 'Text',
};

export function mediaTypeLabel(mediaType: string, fileName?: string): string {
  const known = MEDIA_TYPE_LABELS[mediaType.split(';')[0]?.trim().toLowerCase() ?? ''];
  if (known) return known;
  // Browsers sometimes send an empty or generic type for the OOXML formats;
  // fall back to the extension rather than showing "application/octet-stream".
  const extension = fileName?.split('.').pop()?.toUpperCase();
  return extension && extension.length <= 5 ? extension : 'Khác';
}

/**
 * The backend types revision `status` as a free string and reports ingestion
 * through two parallel fields — the revision's own `status` and the RAGFlow
 * mirror `ragflow_sync_status`. A revision is only "indexed" once RAGFlow has
 * actually synced it, so a failure on either side surfaces as failed and
 * anything still in flight stays "processing" rather than claiming success.
 */
export function toDocumentStatus(revision: RevisionDto | undefined): DocumentStatus {
  if (!revision) return 'queued';

  const status = revision.status.toLowerCase();
  const sync = revision.ragflow_sync_status?.toLowerCase() ?? '';

  if (status === 'failed' || status === 'error' || sync === 'failed') return 'failed';
  if (status === 'queued' || status === 'pending') return 'queued';
  if (sync === 'synced' || sync === 'completed') return 'indexed';
  // `status: ready` with the RAGFlow mirror still pending means the file landed
  // but embedding has not finished — that is the indeterminate bar, not done.
  if (status === 'indexed' || status === 'completed' || status === 'ready') {
    return sync === '' || sync === 'pending' || sync === 'syncing' ? 'processing' : 'indexed';
  }
  return 'processing';
}

/** Newest revision by `revision_no`; the list endpoint sends no revisions at all. */
export function newestRevision(revisions: readonly RevisionDto[] | null | undefined) {
  if (!revisions?.length) return undefined;
  return revisions.reduce((newest, candidate) =>
    candidate.revision_no > newest.revision_no ? candidate : newest
  );
}

export function toDocument(dto: DocumentDto, revisions?: readonly RevisionDto[] | null): Document {
  const revision = newestRevision(revisions);

  return {
    id: dto.id,
    // The document carries a user-facing title; the file name lives on the
    // revision. Prefer the title — it is what the uploader typed.
    name: dto.title || revision?.file_name || 'Không tên',
    format: revision ? mediaTypeLabel(revision.media_type, revision.file_name) : '—',
    sizeBytes: revision?.size_bytes ?? 0,
    // No chunk counter exists on the wire yet (requested in docs/api-gaps.md).
    // Null renders as "—"; a fabricated 0 would read as "indexed but empty".
    chunkCount: null,
    status: toDocumentStatus(revision),
    updatedAt: dto.updated_at,
    fileName: revision?.file_name ?? null,
    revisionId: revision?.id ?? null,
    revisionNo: revision?.revision_no ?? null,
    errorMessage: revision?.error_detail ?? revision?.ragflow_last_error ?? null,
    version: dto.version,
  };
}
