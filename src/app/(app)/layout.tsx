import { redirect } from 'next/navigation';

import { getSession } from '@/core/auth/session';
import { authRoutes, UserMenu } from '@/features/auth';
import { AppTopBar } from '@/shared/components';

/**
 * Shell for every authenticated screen: sticky top bar plus the 1536px content
 * column from the mockup. The session gate lives here so no page under `(app)`
 * has to repeat it.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect(authRoutes.login);

  return (
    <>
      <AppTopBar actions={<UserMenu name={session.name} />} />
      <div className="mx-auto max-w-[1536px] p-4 lg:p-6">{children}</div>
    </>
  );
}
