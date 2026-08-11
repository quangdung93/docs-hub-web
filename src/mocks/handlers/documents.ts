import { http, HttpResponse } from 'msw';

import {
  DocumentListSchema,
  DocumentSchema,
} from '../../features/documents/schemas/document.schema';
import { db } from '../lib/db';
import { envelope } from '../lib/envelope';

/** Format summary shown in the table's second line, derived from the extension. */
function describeFormat(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase() ?? '';
  const labels: Record<string, string> = {
    pdf: 'PDF',
    docx: 'Word',
    doc: 'Word',
    md: 'Markdown',
    txt: 'Plain text',
    xlsx: 'Excel',
  };
  return labels[extension] ?? extension.toUpperCase();
}

export const documentHandlers = [
  http.get('*/projects/:projectId/documents', ({ params }) => {
    const documents = db.documents[String(params.projectId)] ?? [];
    return HttpResponse.json(envelope(DocumentListSchema.parse(documents)));
  }),

  http.post('*/projects/:projectId/documents', async ({ params, request }) => {
    const projectId = String(params.projectId);
    const form = await request.formData();
    const file = form.get('file');
    const name = file instanceof File ? file.name : 'uploaded-file';
    const sizeBytes = file instanceof File ? file.size : 0;

    // Newly uploaded files land in `processing` — the UI shows the indeterminate
    // embedding state until a later poll flips them to `indexed`.
    const document = DocumentSchema.parse({
      id: `d-${Date.now()}`,
      name,
      format: describeFormat(name),
      sizeBytes,
      chunkCount: null,
      status: 'processing',
      updatedAt: new Date().toISOString(),
    });

    db.documents[projectId] = [document, ...(db.documents[projectId] ?? [])];

    // No counter to maintain: ProjectResponse does not expose document counts,
    // so the mock does not invent one either.

    return HttpResponse.json(envelope(document), { status: 201 });
  }),

  http.delete('*/projects/:projectId/documents/:documentId', ({ params }) => {
    const projectId = String(params.projectId);
    const documents = db.documents[projectId] ?? [];
    const index = documents.findIndex((item) => item.id === params.documentId);

    if (index >= 0) {
      documents.splice(index, 1);
    }

    return HttpResponse.json(envelope({ ok: true }));
  }),
];
