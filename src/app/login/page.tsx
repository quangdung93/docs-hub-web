import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { getSession } from '@/core/auth/session';
import { authRoutes, LoginForm, LoginHero, LoginPanel } from '@/features/auth';

export const metadata: Metadata = { title: 'Sign in' };

/**
 * Login page. Already-authenticated users are bounced to the project picker.
 * The split hero/form layout mirrors the mockup; both halves are client
 * components because every label goes through the locale dictionary.
 */
export default async function LoginPage() {
  if (await getSession()) redirect(authRoutes.projects);

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl items-center p-4">
      <div className="border-border bg-surface grid min-h-[560px] overflow-hidden rounded-2xl border shadow-sm md:grid-cols-2">
        <LoginHero />
        <LoginPanel>
          <LoginForm />
        </LoginPanel>
      </div>
    </div>
  );
}
