import { http, HttpResponse } from 'msw';

import { db } from '../lib/db';
import { envelope, failure, paginate } from '../lib/envelope';
import type { Document } from '../../features/documents/schemas/document.schema';

/**
 * Documents mock, speaking the **docs-hub-api wire contract** — a document
 * identity plus a list of revisions, snake_case, wrapped in the standard
 * envelope. The fixtures in `db` are domain-shaped, so this module converts on
 * the way out; that keeps the seed data readable while still exercising the same
 * DTO parsing and mapping code the real backend does.
 */

const MEDIA_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv',
  md: 'text/markdown',
  txt: 'text/plain',
};

function mediaTypeOf(fileName: string): string {
  return MEDIA_TYPES[fileName.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream';
}

/** Domain fixture → the `domain.Document` the backend returns. */
function toDocumentDto(document: Document, projectId: string) {
  return {
    id: document.id,
    project_id: projectId,
    created_by: 'u-admin',
    title: document.name,
    document_key: document.id,
    description: '',
    version: document.version,
    created_at: document.updatedAt,
    updated_at: document.updatedAt,
  };
}

/**
 * Domain fixture → `domain.Revision`. The real backend reports ingestion through
 * two fields at once, so the mock does too: a document that is merely stored
 * shows `ragflow_sync_status: pending`, and only a synced one reads as indexed.
 */
function toRevisionDto(document: Document, projectId: string) {
  const failed = document.status === 'failed';
  return {
    id: document.revisionId ?? `r-${document.id}`,
    document_id: document.id,
    project_id: projectId,
    created_by: 'u-admin',
    scope: { project_version_id: 'v-mock-draft' },
    revision_no: document.revisionNo ?? 1,
    file_name: document.fileName ?? document.name,
    media_type: mediaTypeOf(document.fileName ?? document.name),
    sha256: `${document.id}`.padEnd(64, '0').slice(0, 64),
    size_bytes: document.sizeBytes,
    status: failed ? 'failed' : 'ready',
    error_code: failed ? 'INGEST_FAILED' : null,
    error_detail: document.errorMessage,
    ragflow_sync_status:
      document.status === 'indexed'
        ? 'synced'
        : document.status === 'failed'
          ? 'failed'
          : 'pending',
    ragflow_last_error: null,
    ragflow_synced_at: document.status === 'indexed' ? document.updatedAt : null,
    created_at: document.updatedAt,
    updated_at: document.updatedAt,
  };
}

/** Poll counter per document, so the mocked pipeline can advance over time. */
const pollCount = new Map<string, number>();

function documentsOf(projectId: string): Document[] {
  return db.documents[projectId] ?? [];
}

export const documentHandlers = [
  /** Versions an upload can be scoped to. */
  http.get('*/projects/:projectId/versions', ({ params }) => {
    const projectId = String(params.projectId);
    const versions = [
      {
        id: 'v-mock-draft',
        project_id: projectId,
        label: 'v1.1.0',
        sequence_no: 2,
        status: 'draft',
        released_at: null,
        created_by: 'u-admin',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'v-mock-published',
        project_id: projectId,
        label: 'v1.0.0',
        sequence_no: 1,
        status: 'published',
        released_at: new Date().toISOString(),
        created_by: 'u-admin',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
    return HttpResponse.json(envelope(versions, paginate(versions.length, 1, 20)));
  }),

  http.post('*/projects/:projectId/versions', async ({ params, request }) => {
    const body = (await request.json()) as { label?: string };
    return HttpResponse.json(
      envelope({
        id: `v-${Date.now()}`,
        project_id: String(params.projectId),
        label: body.label ?? 'v0.0.1',
        sequence_no: 3,
        status: 'draft',
        released_at: null,
        created_by: 'u-admin',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
      { status: 201 }
    );
  }),

  /** The list endpoint deliberately omits revisions, exactly like the backend. */
  http.get('*/projects/:projectId/documents', ({ params, request }) => {
    const projectId = String(params.projectId);
    const url = new URL(request.url);
    const query = url.searchParams.get('q')?.toLowerCase();

    const documents = documentsOf(projectId).filter(
      (document) => !query || document.name.toLowerCase().includes(query)
    );

    return HttpResponse.json(
      envelope(
        documents.map((document) => toDocumentDto(document, projectId)),
        paginate(documents.length, 1, 20)
      )
    );
  }),

  http.get('*/projects/:projectId/documents/:documentId', ({ params }) => {
    const projectId = String(params.projectId);
    const document = documentsOf(projectId).find((item) => item.id === params.documentId);

    if (!document) {
      return HttpResponse.json(failure('NOT_FOUND', 'Không tìm thấy tài liệu'), { status: 404 });
    }

    return HttpResponse.json(
      envelope({
        document: toDocumentDto(document, projectId),
        revisions: [toRevisionDto(document, projectId)],
      })
    );
  }),

  /** Multipart upload — answers 202 with the document/revision pair. */
  http.post('*/projects/:projectId/documents/uploads', async ({ params, request }) => {
    const projectId = String(params.projectId);
    const form = await request.formData();
    const file = form.get('file');

    if (!form.get('project_version_id') && !form.get('change_request_id')) {
      return HttpResponse.json(
        failure('REQ_400', 'Phải chọn đúng một version hoặc change request'),
        { status: 400 }
      );
    }

    // `@mswjs/http-middleware` does not always carry the multipart filename onto
    // the File, so fall back to the explicit form field before giving up.
    const uploadedName =
      (file instanceof File && file.name) || String(form.get('file_name') ?? '') || 'uploaded-file';
    const name = uploadedName;
    const id = `d-${Date.now()}`;

    // A fresh upload is stored but not yet embedded — `processing`, so the UI
    // shows the indeterminate bar rather than claiming the file is searchable.
    const document: Document = {
      id,
      // Title is what the user typed; `fileName` keeps the real upload name so the
      // revision can report a correct media type (a title carries no extension).
      name: String(form.get('title') ?? name),
      fileName: name,
      format: name.split('.').pop()?.toUpperCase() ?? '—',
      sizeBytes: file instanceof File ? file.size : 0,
      chunkCount: null,
      status: 'processing',
      updatedAt: new Date().toISOString(),
      revisionId: `r-${id}`,
      revisionNo: 1,
      errorMessage: null,
      version: 1,
    };

    db.documents[projectId] = [document, ...documentsOf(projectId)];

    return HttpResponse.json(
      envelope({
        document: toDocumentDto(document, projectId),
        revision: toRevisionDto(document, projectId),
      }),
      { status: 202 }
    );
  }),

  http.get(
    '*/projects/:projectId/documents/:documentId/revisions/:revisionId/status',
    ({ params }) => {
      const projectId = String(params.projectId);
      const document = documentsOf(projectId).find((item) => item.id === params.documentId);

      if (!document) {
        return HttpResponse.json(failure('NOT_FOUND', 'Không tìm thấy tài liệu'), { status: 404 });
      }

      // Advance the pipeline one step per poll. A mock that answers the same
      // state forever cannot exercise the stepper at all — and the real backend
      // is currently stuck at `queued`, so this is the only way to see the
      // parse → chunk → embed transitions before RAGFlow is connected.
      const revision = toRevisionDto(document, projectId);
      if (document.status !== 'failed' && document.status !== 'indexed') {
        const polls = (pollCount.get(document.id) ?? 0) + 1;
        pollCount.set(document.id, polls);

        if (polls === 1) revision.status = 'queued';
        else if (polls === 2) revision.ragflow_sync_status = 'pending';
        else if (polls === 3) revision.ragflow_sync_status = 'syncing';
        else {
          revision.ragflow_sync_status = 'synced';
          document.status = 'indexed';
        }
      }

      return HttpResponse.json(envelope(revision));
    }
  ),

  http.post(
    '*/projects/:projectId/documents/:documentId/revisions/:revisionId/retry',
    ({ params }) => {
      const projectId = String(params.projectId);
      const document = documentsOf(projectId).find((item) => item.id === params.documentId);

      // Mirrors the backend: only a failed revision may be retried.
      if (document && document.status !== 'failed') {
        return HttpResponse.json(
          failure('DOCUMENT_RETRY_INVALID', 'Chỉ revision thất bại mới được retry')
        );
      }

      if (document) {
        document.status = 'processing';
        pollCount.delete(document.id);
      }
      return HttpResponse.json(envelope({ status: 'queued' }), { status: 202 });
    }
  ),

  http.patch('*/projects/:projectId/documents/:documentId', async ({ params, request }) => {
    const projectId = String(params.projectId);
    const document = documentsOf(projectId).find((item) => item.id === params.documentId);

    if (!document) {
      return HttpResponse.json(failure('NOT_FOUND', 'Không tìm thấy tài liệu'), { status: 404 });
    }

    const body = (await request.json()) as { title?: string; version?: number };

    // Optimistic locking, same as the real backend.
    if (typeof body.version === 'number' && body.version !== document.version) {
      return HttpResponse.json(
        failure('CONFLICT_VERSION', 'Dữ liệu đã được cập nhật bởi người khác')
      );
    }

    if (body.title) document.name = body.title;
    document.version += 1;
    document.updatedAt = new Date().toISOString();

    return HttpResponse.json(envelope(toDocumentDto(document, projectId)));
  }),

  /** Soft delete — 204 with no body, like the backend. */
  http.delete('*/projects/:projectId/documents/:documentId', ({ params }) => {
    const projectId = String(params.projectId);
    const documents = documentsOf(projectId);
    const index = documents.findIndex((item) => item.id === params.documentId);

    if (index >= 0) documents.splice(index, 1);

    return new HttpResponse(null, { status: 204 });
  }),
];
