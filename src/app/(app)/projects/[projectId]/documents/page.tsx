import { DocumentListScreen } from '@/features/documents';
import { Card } from '@/shared/ui';

/** Document management screen for a project. */
export default async function ProjectDocumentsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  return (
    <Card>
      <div className="flex min-h-[620px]">
        <DocumentListScreen projectId={projectId} />
      </div>
    </Card>
  );
}
