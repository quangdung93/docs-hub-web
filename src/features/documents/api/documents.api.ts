import { apiSuccessSchema, endpoints } from '@/core/api';
import { http } from '@/shared/api/http';

import {
  DocumentDetailDtoSchema,
  DocumentDtoSchema,
  DocumentListDtoSchema,
  ProjectVersionDtoSchema,
  ProjectVersionListDtoSchema,
  ReportHistoryDtoSchema,
  ReportResultDtoSchema,
  RevisionDtoSchema,
  UploadResponseDtoSchema,
  type ProjectVersionDto,
  type ReportResultDto,
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

/** Same-origin BFF prefix, mirroring the Axios instance's baseURL. */
const API_BASE = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/api`;

export interface DocumentListParams {
  page?: number;
  limit?: number;
  /** Free-text search over the title. */
  q?: string;
  /** Lấy kèm tài liệu đã xóa mềm. Mặc định backend lọc chúng ra. */
  includeDeleted?: boolean;
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

export type ReportFormat = 'xlsx' | 'pdf';

/** Everything `POST .../documents/uat-report` accepts. All of it optional. */
export interface UatReportOptions {
  format?: ReportFormat;
  /** Narrows the export to one version. Omit for every latest document. */
  projectVersionId?: string;
  /** Header block of the ISC template. */
  po?: string;
  pm?: string;
  scopeTest?: string;
  accountTest?: string;
  /** Test window. Dates, not datetimes, as far as the user is concerned. */
  startDate?: string;
  dueDate?: string;
}

/**
 * Build the request body, dropping blank fields and widening dates.
 *
 * The date fields demand full RFC 3339: `2026-09-01` is rejected with REQ_400
 * while `2026-09-01T00:00:00Z` is accepted (verified 09/09/2026). Swagger types
 * both as a bare string, so this is the only place that knows. The UI collects
 * them from `<input type="date">`, which always yields the short form.
 *
 * Blank strings are omitted rather than sent: the backend prints whatever it is
 * given straight into the sheet, so an empty field would stamp an empty label
 * over the template's own placeholder.
 */
export function toUatReportBody(options: UatReportOptions): Record<string, string> {
  const atMidnight = (date?: string) => (date?.trim() ? `${date.trim()}T00:00:00Z` : undefined);

  const body: Record<string, string | undefined> = {
    format: options.format,
    project_version_id: options.projectVersionId,
    po: options.po?.trim(),
    pm: options.pm?.trim(),
    scope_test: options.scopeTest?.trim(),
    account_test: options.accountTest?.trim(),
    start_date: atMidnight(options.startDate),
    due_date: atMidnight(options.dueDate),
  };

  return Object.fromEntries(
    Object.entries(body).filter((entry): entry is [string, string] => Boolean(entry[1]))
  );
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
    const { includeDeleted, ...rest } = params;
    const { data } = await http.get(endpoints.documents.list(projectId), {
      // Tên tham số trên wire là snake_case; phần còn lại đã trùng tên nên đi thẳng.
      params: { ...rest, ...(includeDeleted ? { include_deleted: true } : {}) },
      signal,
    });
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
        // `GET /documents/{id}` trả 404 cho tài liệu đã xóa mềm, kể cả khi thêm
        // `include_deleted=true` (kiểm chứng 11/09/2026). Gọi vào đó chỉ tốn một
        // request để rơi vào nhánh catch, nên dựng thẳng từ dữ liệu list.
        if (dto.is_deleted) return toDocument(dto);

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
   *
   * The base path matters: served under a sub-path, a bare `/api` misses the
   * mount point entirely and 404s. Production sits at the root, but the option
   * is what makes a sub-path deployment possible at all.
   */
  downloadUrl: (projectId: string, documentId: string, revisionId: string): string =>
    `${API_BASE}${endpoints.documents.revisionDownload(projectId, documentId, revisionId)}`,

  viewUrl: (projectId: string, documentId: string, revisionId: string): string =>
    `${API_BASE}${endpoints.documents.revisionView(projectId, documentId, revisionId)}`,

  /**
   * Export the UAT report. Returns the file bytes, not a URL — the endpoint is
   * a POST, so it cannot be an `<a href>` the way download and view are.
   *
   * This fills the ISC template mechanically; it does not go through RAGFlow.
   * That is why it stays available when `reportsApi.generate` is answering
   * EXT_504, and why it is the export the UI reaches for by default.
   *
   * Every field is optional — an empty body exports the whole project in xlsx.
   * All of them were verified against the running API on 09/09/2026:
   *  - `format: 'pdf'` returns a real PDF (3 pages, ~52 KB), not a renamed
   *    workbook. The UI used to refuse it as unimplemented; it was not.
   *  - `projectVersionId` narrows the scope and works. An older comment here
   *    claimed it only ever answered 400 — that is no longer true.
   *  - The PO/PM/scope fields land in the generated sheet (checked by writing
   *    markers and reading them back out of the xlsx XML).
   */
  exportUatReport: async (
    projectId: string,
    options: UatReportOptions = {}
  ): Promise<{ blob: Blob; fileName: string }> => {
    const response = await http.post(
      endpoints.documents.uatReport(projectId),
      toUatReportBody(options),
      { responseType: 'blob' }
    );

    // The backend names the file itself — `UAT_Report_DOCS-HUB-DEMO_all.xlsx`,
    // carrying the project key and the scope. Keeping that beats a fixed name,
    // which would collide the moment someone exports two projects.
    return {
      blob: response.data as Blob,
      fileName:
        fileNameFrom(response.headers['content-disposition']) ??
        `UAT_Report.${options.format ?? 'xlsx'}`,
    };
  },
};

/**
 * Pull the filename out of a `Content-Disposition` header.
 *
 * Handles the RFC 5987 `filename*=UTF-8''…` form first, because that is the one
 * that survives non-ASCII names; a project keyed in Vietnamese would otherwise
 * arrive mangled. Falls back to plain `filename=`, quoted or not.
 *
 * Returns null rather than guessing, so the caller decides the default.
 */
export function fileNameFrom(header: unknown): string | null {
  if (typeof header !== 'string') return null;

  const encoded = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(header);
  if (encoded?.[1]) {
    try {
      return decodeURIComponent(encoded[1].trim().replace(/^"|"$/g, ''));
    } catch {
      // A malformed escape sequence falls through to the plain form below.
    }
  }

  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain?.[1]?.trim() || null;
}

/** The three report types RAGFlow knows how to write. */
export const REPORT_TYPES = ['uat', 'planning', 'testcase'] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export interface GenerateReportInput {
  reportType: ReportType;
  format?: ReportFormat;
  /** Narrows the source documents to one version. */
  projectVersionId?: string;
}

/**
 * RAGFlow-backed report generation, live since 09/09/2026.
 *
 * Unlike `documentsApi.exportUatReport` — which fills a template mechanically
 * and streams the bytes back — this asks RAGFlow to read the project's
 * documents and write the report, then answers with JSON holding a presigned
 * `download_url` (900s, no bearer token, points at storage not the API).
 *
 * It accepts only these four fields. The PO/PM/scope/date inputs the template
 * export takes are silently ignored here: sending them returns 200 and they do
 * not appear in the workbook (verified 09/09/2026). That is why the UI keeps
 * both exports rather than folding one into the other.
 *
 * Generation is slow (tens of seconds) and can fail on content rather than on
 * the request — `uat` answers REQ_400 "Không tìm thấy User Story/Acceptance
 * Criteria" when the project holds no user stories to work from. Those messages
 * are written for the user, so they are surfaced verbatim.
 */
export const reportsApi = {
  generate: async (projectId: string, input: GenerateReportInput): Promise<ReportResultDto> => {
    const { data } = await http.post(endpoints.reports.generate(projectId), {
      report_type: input.reportType,
      ...(input.format ? { format: input.format } : {}),
      ...(input.projectVersionId ? { project_version_id: input.projectVersionId } : {}),
    });
    return apiSuccessSchema(ReportResultDtoSchema).parse(data).data;
  },

  /** Past exports, newest first, each with a freshly signed download link. */
  history: async (projectId: string, signal?: AbortSignal): Promise<ReportResultDto[]> => {
    const { data } = await http.get(endpoints.reports.history(projectId), { signal });
    return apiSuccessSchema(ReportHistoryDtoSchema).parse(data).data;
  },
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

  /**
   * Create a draft version.
   *
   * `note` is sent but the backend currently drops it — the response echoes back
   * only `label`, verified 28/08/2026. It is sent anyway because the field costs
   * nothing, the UI already collects it, and the day the backend persists it
   * this starts working with no client change. Do not surface a saved note until
   * the response actually carries one.
   */
  create: async (projectId: string, label: string, note?: string): Promise<ProjectVersionDto> => {
    const { data } = await http.post(endpoints.versions.create(projectId), {
      label,
      ...(note?.trim() ? { note: note.trim() } : {}),
    });
    return apiSuccessSchema(ProjectVersionDtoSchema).parse(data).data;
  },
};
