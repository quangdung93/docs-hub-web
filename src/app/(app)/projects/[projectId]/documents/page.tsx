import { HydrationBoundary, dehydrate } from '@tanstack/react-query';

import { queryKeys } from '@/core/api/query-keys';
import { createServerQueryClient } from '@/core/api/server-query-client';
import { DocumentListScreen } from '@/features/documents';
import { fetchDocumentsOnServer } from '@/features/documents/api/documents.server';
import { Card } from '@/shared/ui';

/**
 * Document management screen for a project.
 *
 * The list is prefetched here rather than left to the client. Building it costs
 * 21 requests — one list plus one detail per row, because the list endpoint omits
 * revisions — which is ~1.5s of skeleton when it runs from the browser. Server-
 * side those requests run next to the backend and land in the HTML, so the first
 * paint already has rows.
 *
 * The client query stays exactly as it was: it finds the data already in cache,
 * and refetches on its own schedule.
 */
export default async function ProjectDocumentsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const queryClient = createServerQueryClient();
  const documents = await fetchDocumentsOnServer(projectId);
  // Undefined means the prefetch failed; leaving the cache empty lets the client
  // query run normally instead of hydrating a broken state.
  if (documents) {
    queryClient.setQueryData(queryKeys.documents.list(projectId, {}), documents);
  }

  return (
    <Card>
      <div className="flex min-h-[620px]">
        <HydrationBoundary state={dehydrate(queryClient)}>
          <DocumentListScreen projectId={projectId} />
        </HydrationBoundary>
      </div>
    </Card>
  );
}
