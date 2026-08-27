import { redirect } from 'next/navigation';

import { getSession } from '@/core/auth/session';
import { authRoutes } from '@/features/auth';

/** Entry point — straight to the project picker, or to login if there's no session. */
export default async function HomePage() {
  redirect((await getSession()) ? authRoutes.projects : authRoutes.login);
}
