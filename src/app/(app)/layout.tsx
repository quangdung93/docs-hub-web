import { redirect } from 'next/navigation';

import { getSession } from '@/core/auth/session';
import { authRoutes } from '@/features/auth';
import { AppTopBar } from '@/shared/components';

/**
 * Shell for every authenticated screen: sticky top bar plus the 1240px content
 * column from the mockup. The session gate lives here so no page under `(app)`
 * has to repeat it.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!(await getSession())) redirect(authRoutes.login);

  return (
    <>
      <AppTopBar />
      <div className="mx-auto max-w-[1240px] p-4">{children}</div>
    </>
  );
}
