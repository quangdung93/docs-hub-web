import { ProjectSettingsScreen } from '@/features/projects';

/** Project settings — general info, members and configuration tabs. */
export default async function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <ProjectSettingsScreen projectId={projectId} />;
}
