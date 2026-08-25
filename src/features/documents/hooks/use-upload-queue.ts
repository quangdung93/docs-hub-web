'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import { queryKeys } from '@/core/api';

import { documentsApi } from '../api/documents.api';
import { useCreateProjectVersion, useProjectVersions } from './use-documents';
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
 *
 * Every upload must name the project version it belongs to. The caller can pass
 * one explicitly; otherwise the newest **draft** version is used, since a
 * published version is frozen and the backend refuses writes to it.
 */
export function useUploadQueue(projectId: string, projectVersionId?: string) {
  const queryClient = useQueryClient();
  const [items, setItems] = useState<UploadItem[]>([]);
  const { data: versions } = useProjectVersions(projectId);
  const createVersion = useCreateProjectVersion(projectId);

  /** Explicit pick from the version selector; null until the user chooses. */
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);

  // Published versions are frozen — the backend refuses writes to them — so only
  // drafts can receive an upload. Newest first, which is what the selector shows.
  const draftVersions = (versions ?? [])
    .filter((version) => version.status === 'draft')
    .sort((a, b) => b.sequence_no - a.sequence_no);

  // A selection that no longer exists (version published elsewhere, list
  // refetched) must not silently target a dead id — fall back to the newest.
  const selectedStillValid =
    selectedVersionId !== null && draftVersions.some((v) => v.id === selectedVersionId);

  const targetVersionId =
    projectVersionId ?? (selectedStillValid ? selectedVersionId : draftVersions[0]?.id);

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

        // No draft version means there is nowhere to put the file. Fail the row
        // with a reason rather than firing a request the backend will reject.
        if (!targetVersionId) {
          patch(item.id, { status: 'failed', progress: undefined, error: 'no-version' });
          continue;
        }

        documentsApi
          .upload(projectId, file, {
            projectVersionId: targetVersionId,
            title: file.name,
            onProgress: (percent) => patch(item.id, { progress: percent }),
          })
          .then((document) => {
            // Upload finished; the server is now embedding — progress is unknowable,
            // so drop to the indeterminate state until the document reports back.
            patch(item.id, {
              status: document.status === 'indexed' ? 'indexed' : 'embedding',
              progress: undefined,
              chunkCount: document.chunkCount ?? undefined,
              documentId: document.id,
              revisionId: document.revisionId ?? undefined,
            });
            void queryClient.invalidateQueries({ queryKey: queryKeys.documents.all });
            void queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
          })
          // The server rejected the upload (bad format, storage down, …). Report
          // it as failed — not as a format rejection, which would be a guess.
          .catch(() => patch(item.id, { status: 'failed', progress: undefined }));
      }
    },
    [patch, projectId, queryClient, targetVersionId]
  );

  const removeItem = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  /**
   * Settle a row from what the ingestion pipeline reported. The upload request
   * only tells us the file was accepted; how the worker finished arrives later,
   * through the per-row status poll.
   */
  const markSettled = useCallback((id: string, status: 'indexed' | 'failed') => {
    setItems((current) =>
      current.map((item) => (item.id === id && item.status !== status ? { ...item, status } : item))
    );
  }, []);

  /**
   * Create a draft version and target it. This is the way out of the dead end a
   * project with no versions puts the user in: the backend rejects every upload
   * until one exists, and nothing else in the UI creates one.
   */
  const addVersion = useCallback(
    async (label: string) => {
      const created = await createVersion.mutateAsync(label);
      setSelectedVersionId(created.id);
      return created;
    },
    [createVersion]
  );

  return {
    items,
    addFiles,
    removeItem,
    markSettled,
    progress: queueProgress(items),
    /** False when the project has no draft version — the panel explains why. */
    canUpload: Boolean(targetVersionId),
    /** Draft versions an upload can target, newest first. */
    draftVersions,
    targetVersionId,
    selectVersion: setSelectedVersionId,
    addVersion,
    isAddingVersion: createVersion.isPending,
  };
}
