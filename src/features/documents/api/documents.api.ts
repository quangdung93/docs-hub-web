import { apiSuccessSchema, endpoints } from '@/core/api';
import { http } from '@/shared/api/http';

import {
  DocumentDetailDtoSchema,
  DocumentDtoSchema,
  DocumentListDtoSchema,
  ProjectVersionDtoSchema,
  ProjectVersionListDtoSchema,
  RevisionDtoSchema,
  UploadResponseDtoSchema,
  type ProjectVersionDto,
} from './document.dto';
import { toDocument, toDocumentStatus } from '../services/document.mapper';
import { toIngestionStage } from '../services/ingestion.service';
import { type Document } from '../schemas/document.schema';

/**
 * Documents transport for docs-hub-api.
 *
 * One thing this layer owns, because the backend requires it and no component
 * should have to know: **scope**. An upload belongs to exactly one project
 * version (or change request); sending neither — or both — is a `REQ_400`.
 *
 * `sha256` used to be mandatory and is no longer sent (Swagger dropped it on
 * 25/08/2026, and the running build accepts uploads without it). Computing it
 * meant reading the whole file into memory via WebCrypto before a single byte
 * went out, so dropping it is a straight win for large uploads.
 */

export interface DocumentListParams {
  page?: number;
  limit?: number;
  /** Free-text search over the title. */
  q?: string;
}

export interface UploadOptions {
  /** The draft version the revision lands in. Required unless `changeRequestId` is set. */
  projectVersionId?: string;
  changeRequestId?: string;
  /** Add a revision to this existing document instead of creating a new one. */
  documentId?: string;
  title?: string;
  description?: string;
  onProgress?: (percent: number) => void;
}

export const documentsApi = {
  /**
   * List documents in a project.
   *
   * Only `page`, `limit` and `q` are forwarded. The backend also documents
   * `status`, `type` and `version_id`, but each one currently answers `SYS_500`
   * (verified 21/08/2026), so they are filtered client-side instead of sending a
   * request that is known to fail. Re-enable here once the backend is fixed.
   */
  list: async (
    projectId: string,
    params: DocumentListParams = {},
    signal?: AbortSignal
  ): Promise<Document[]> => {
    const { data } = await http.get(endpoints.documents.list(projectId), { params, signal });
    const dtos = apiSuccessSchema(DocumentListDtoSchema).parse(data).data;

    // The list endpoint omits revisions, and revisions are where size, format and
    // ingestion status live — so a list-only row would show every document as
    // "0 B / queued" regardless of its real state. Fetch the detail for each row
    // to fill those in. Requests run concurrently, and one failure degrades that
    // single row to its list-only values rather than emptying the table.
    //
    // This is an N+1 and it is deliberate: it is the only way to render the
    // columns the table has. `GET /documents` returning the latest revision
    // inline would remove it — requested in docs/api-gaps.md.
    return Promise.all(
      dtos.map(async (dto) => {
        try {
          const { data: detail } = await http.get(endpoints.documents.detail(projectId, dto.id), {
            signal,
          });
          const parsed = apiSuccessSchema(DocumentDetailDtoSchema).parse(detail).data;
          return toDocument(parsed.document, parsed.revisions);
        } catch {
          return toDocument(dto);
        }
      })
    );
  },

  /** Document plus its full revision history. */
  detail: async (projectId: string, documentId: string, signal?: AbortSignal) => {
    const { data } = await http.get(endpoints.documents.detail(projectId, documentId), { signal });
    const detail = apiSuccessSchema(DocumentDetailDtoSchema).parse(data).data;
    return {
      document: toDocument(detail.document, detail.revisions),
      revisions: detail.revisions ?? [],
    };
  },

  /**
   * Multipart upload. Creates a new document, or appends a revision when
   * `documentId` is given — the backend uses two different paths for that.
   */
  upload: async (projectId: string, file: File, options: UploadOptions): Promise<Document> => {
    const form = new FormData();
    form.append('file', file);
    form.append('size_bytes', String(file.size));
    // The real backend reads the name off the multipart part itself; sending it
    // as a field too costs nothing and keeps the MSW mock (whose parser drops the
    // filename) reporting the same media type as production.
    form.append('file_name', file.name);

    if (options.projectVersionId) form.append('project_version_id', options.projectVersionId);
    if (options.changeRequestId) form.append('change_request_id', options.changeRequestId);
    if (options.description) form.append('description', options.description);

    const url = options.documentId
      ? endpoints.documents.uploadRevision(projectId, options.documentId)
      : endpoints.documents.upload(projectId);

    // `title` is required when creating a document and rejected as unknown noise
    // otherwise; default it to the file name so the user never sees a blank row.
    if (!options.documentId) form.append('title', options.title || file.name);

    const { data } = await http.post(url, form, {
      onUploadProgress: (event) => {
        if (!options.onProgress || !event.total) return;
        options.onProgress(Math.round((event.loaded / event.total) * 100));
      },
    });

    const result = apiSuccessSchema(UploadResponseDtoSchema).parse(data).data;
    return toDocument(result.document, [result.revision]);
  },

  /** Rename / re-describe. `version` is the optimistic lock read from the row. */
  update: async (
    projectId: string,
    documentId: string,
    input: { title: string; description?: string; version: number }
  ): Promise<Document> => {
    const { data } = await http.patch(endpoints.documents.update(projectId, documentId), input);
    return toDocument(apiSuccessSchema(DocumentDtoSchema).parse(data).data);
  },

  /** Soft delete — the backend answers 204 with no body. */
  remove: async (projectId: string, documentId: string): Promise<void> => {
    await http.delete(endpoints.documents.remove(projectId, documentId));
  },

  /**
   * Poll one revision's ingestion state. Returns the pipeline `stage` alongside
   * the coarse `status`: the badge needs one word, the processing panel needs to
   * know which of parse / chunk / embed is running or broke.
   */
  revisionStatus: async (projectId: string, documentId: string, revisionId: string) => {
    const { data } = await http.get(
      endpoints.documents.revisionStatus(projectId, documentId, revisionId)
    );
    const revision = apiSuccessSchema(RevisionDtoSchema).parse(data).data;
    return {
      revision,
      status: toDocumentStatus(revision),
      stage: toIngestionStage(revision),
    };
  },

  /** Re-run ingestion for a revision that failed. */
  retryRevision: async (projectId: string, documentId: string, revisionId: string) => {
    await http.post(endpoints.documents.revisionRetry(projectId, documentId, revisionId));
  },

  /**
   * Download / inline-view URLs. These are same-origin BFF paths, not presigned
   * storage links, so the browser can hit them directly and the proxy attaches
   * the bearer token — no credentials end up in a URL.
   */
  downloadUrl: (projectId: string, documentId: string, revisionId: string): string =>
    `/api${endpoints.documents.revisionDownload(projectId, documentId, revisionId)}`,

  viewUrl: (projectId: string, documentId: string, revisionId: string): string =>
    `/api${endpoints.documents.revisionView(projectId, documentId, revisionId)}`,
};

/**
 * Project versions. Uploads are scoped to one, so the upload screen has to be
 * able to list them and create a draft.
 */
export const versionsApi = {
  list: async (projectId: string, signal?: AbortSignal): Promise<ProjectVersionDto[]> => {
    const { data } = await http.get(endpoints.versions.list(projectId), { signal });
    return apiSuccessSchema(ProjectVersionListDtoSchema).parse(data).data;
  },

  create: async (projectId: string, label: string): Promise<ProjectVersionDto> => {
    const { data } = await http.post(endpoints.versions.create(projectId), { label });
    return apiSuccessSchema(ProjectVersionDtoSchema).parse(data).data;
  },
};
