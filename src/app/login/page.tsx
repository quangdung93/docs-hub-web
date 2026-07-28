import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { getSession } from '@/core/auth/session';
import { LoginForm } from '@/features/auth';

export const metadata: Metadata = { title: 'Sign in' };

/**
 * Login page. Already-authenticated users are bounced to the app. The demo
 * credentials hint reflects the seeded mock user (Module 4).
 */
export default async function LoginPage() {
  if (await getSession()) redirect('/account');

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-8 px-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in to Document Hub</h1>
        <p className="text-muted-foreground text-sm">Use your account to continue.</p>
      </div>

      <LoginForm />

      <p className="border-border bg-muted/50 text-muted-foreground rounded-md border px-3 py-2 text-center text-xs">
        Demo: <span className="font-medium">admin@docs-hub.local</span> /{' '}
        <span className="font-medium">Password123!</span>
      </p>
    </main>
  );
}
