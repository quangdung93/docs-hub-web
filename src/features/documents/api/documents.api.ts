import { apiSuccessSchema, endpoints } from '@/core/api';
import { http } from '@/shared/api/http';

import { type Document, DocumentListSchema, DocumentSchema } from '../schemas/document.schema';

/**
 * Documents transport. `upload` posts multipart and reports byte progress, which
 * is the one place the UI genuinely needs a percentage — the embedding phase that
 * follows has no client-visible progress, hence the indeterminate bar.
 */
export const documentsApi = {
  list: async (projectId: string, signal?: AbortSignal): Promise<Document[]> => {
    const { data } = await http.get(endpoints.documents.list(projectId), { signal });
    return apiSuccessSchema(DocumentListSchema).parse(data).data;
  },

  upload: async (
    projectId: string,
    file: File,
    onProgress?: (percent: number) => void
  ): Promise<Document> => {
    const form = new FormData();
    form.append('file', file);

    const { data } = await http.post(endpoints.documents.upload(projectId), form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (event) => {
        if (!onProgress || !event.total) return;
        onProgress(Math.round((event.loaded / event.total) * 100));
      },
    });

    return apiSuccessSchema(DocumentSchema).parse(data).data;
  },

  remove: async (projectId: string, documentId: string): Promise<void> => {
    await http.delete(endpoints.documents.remove(projectId, documentId));
  },
};
