'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import { queryKeys } from '@/core/api';

import { documentsApi } from '../api/documents.api';
import {
  type UploadItem,
  isRejected,
  queueProgress,
  validateFile,
} from '../services/upload-queue.service';

/**
 * React binding for the upload queue: takes dropped files, runs them through the
 * validation service, uploads the accepted ones and tracks per-file progress.
 * All queue rules live in `upload-queue.service`; this hook only sequences the
 * async work and holds the resulting state.
 */
export function useUploadQueue(projectId: string) {
  const queryClient = useQueryClient();
  const [items, setItems] = useState<UploadItem[]>([]);

  const patch = useCallback((id: string, changes: Partial<UploadItem>) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...changes } : item)));
  }, []);

  const addFiles = useCallback(
    (files: File[]) => {
      const queued: Array<{ item: UploadItem; file: File }> = files.map((file, index) => ({
        file,
        item: {
          // crypto.randomUUID is available in every browser this app targets.
          id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${index}-${file.name}`,
          name: file.name,
          sizeBytes: file.size,
          status: validateFile(file),
          progress: 0,
        },
      }));

      setItems((current) => [...current, ...queued.map(({ item }) => item)]);

      for (const { item, file } of queued) {
        if (isRejected(item.status)) continue;

        documentsApi
          .upload(projectId, file, (percent) => patch(item.id, { progress: percent }))
          .then((document) => {
            // Upload finished; the server is now embedding — progress is unknowable,
            // so drop to the indeterminate state until the document reports back.
            patch(item.id, {
              status: document.status === 'indexed' ? 'indexed' : 'embedding',
              progress: undefined,
              chunkCount: document.chunkCount ?? undefined,
            });
            void queryClient.invalidateQueries({ queryKey: queryKeys.documents.all });
            void queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
          })
          .catch(() => patch(item.id, { status: 'rejected-format', progress: undefined }));
      }
    },
    [patch, projectId, queryClient]
  );

  const removeItem = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  return { items, addFiles, removeItem, progress: queueProgress(items) };
}
