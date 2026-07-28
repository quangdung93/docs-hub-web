import type { Metadata } from 'next';

import { requireSession } from '@/core/auth/session';
import { LogoutButton } from '@/features/auth';

export const metadata: Metadata = { title: 'Account' };

// Session-dependent — never static.
export const dynamic = 'force-dynamic';

/**
 * Protected page (Module 4). `requireSession` redirects to /login when there's no
 * valid session — the authoritative, server-side auth gate. Proves login → cookie
 * → JWT verify → session round-trips.
 */
export default async function AccountPage() {
  const session = await requireSession();

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-8 px-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Account</h1>
        <p className="text-muted-foreground">You are signed in.</p>
      </div>

      <dl className="border-border bg-card grid grid-cols-[8rem_1fr] gap-2 rounded-xl border p-6 text-sm">
        <dt className="text-muted-foreground">Name</dt>
        <dd className="font-medium">{session.name}</dd>
        <dt className="text-muted-foreground">Email</dt>
        <dd className="font-medium">{session.email}</dd>
        <dt className="text-muted-foreground">Roles</dt>
        <dd className="font-medium">{session.roles.join(', ') || '—'}</dd>
      </dl>

      <LogoutButton />
    </main>
  );
}
