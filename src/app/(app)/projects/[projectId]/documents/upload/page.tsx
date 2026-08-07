import { UploadScreen } from '@/features/documents';

/** Document upload screen. */
export default async function UploadPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <UploadScreen projectId={projectId} />;
}
