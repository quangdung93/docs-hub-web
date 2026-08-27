import 'server-only';

import { endpoints } from '@/core/api/endpoints';
import { apiSuccessSchema } from '@/core/api/errors';
import { serverFetch } from '@/core/api/server-fetch';

import { type Document } from '../schemas/document.schema';
import { toDocument } from '../services/document.mapper';

import { DocumentDetailDtoSchema, DocumentListDtoSchema } from './document.dto';

/**
 * Server-side document list, for prefetching on the server so the first paint
 * already has rows instead of a skeleton.
 *
 * It exists separately from `documents.api.ts` because that module is built on
 * Axios, which ESLint forbids in server code — a load-bearing rule, not a
 * nuisance: the client instance targets the BFF and relies on browser cookies,
 * neither of which applies here. The DTOs, the mapper and the N+1 shape are
 * shared; only the transport differs.
 *
 * A failure returns `undefined` rather than throwing. A prefetch is an
 * optimisation: if it does not work the client query runs normally, and taking
 * the whole page down over it would trade a slow screen for no screen.
 */
export async function fetchDocumentsOnServer(projectId: string): Promise<Document[] | undefined> {
  try {
    const response = await serverFetch(endpoints.documents.list(projectId));
    if (!response.ok) return undefined;

    const dtos = apiSuccessSchema(DocumentListDtoSchema).parse(await response.json()).data;

    // Same deliberate N+1 as the client: the list endpoint omits revisions, and
    // size, format and ingestion status all live on the revision. Done here it
    // costs the user nothing — it runs server-side, next to the backend, before
    // the HTML is sent.
    return await Promise.all(
      dtos.map(async (dto) => {
        try {
          const detail = await serverFetch(endpoints.documents.detail(projectId, dto.id));
          if (!detail.ok) return toDocument(dto);
          const parsed = apiSuccessSchema(DocumentDetailDtoSchema).parse(await detail.json()).data;
          return toDocument(parsed.document, parsed.revisions);
        } catch {
          // One unreadable row degrades to its list-only values; the rest render.
          return toDocument(dto);
        }
      })
    );
  } catch {
    return undefined;
  }
}
