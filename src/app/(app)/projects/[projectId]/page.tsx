import { ChatScreen } from '@/features/chat';

/** Q&A screen — the default view of a project. */
export default async function ProjectChatPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <ChatScreen projectId={projectId} />;
}
