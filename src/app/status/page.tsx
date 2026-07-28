import type { Metadata } from 'next';

import { serverFetchJson } from '@/core/api/server-fetch';
import { type Health, HealthSchema } from '@/shared/api/health.schema';
import { HealthBadge } from '@/shared/components/health-badge';

export const metadata: Metadata = { title: 'Status' };

// Always render fresh — this is a liveness view.
export const dynamic = 'force-dynamic';

/**
 * Transport smoke page (Module 3). The server path (RSC → serverFetch → backend)
 * and the client path (HealthBadge → Axios → BFF proxy → backend) both resolve to
 * the same MSW mock, proving the full HTTP spine end to end.
 */
export default async function StatusPage() {
  let health: Health | null = null;
  let error: string | null = null;

  try {
    health = HealthSchema.parse(await serverFetchJson<Health>('/health'));
  } catch (e) {
    error = e instanceof Error ? e.message : 'Unknown error';
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-8 px-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">System status</h1>
        <p className="text-muted-foreground">
          Both transport paths hit the same mock backend (Module 3).
        </p>
      </div>

      <section className="border-border bg-card space-y-3 rounded-xl border p-6">
        <h2 className="text-muted-foreground text-sm font-medium">
          Server path (RSC → serverFetch)
        </h2>
        {error ? (
          <p className="text-destructive">Failed: {error}</p>
        ) : (
          <pre className="bg-muted overflow-x-auto rounded-lg p-4 text-sm">
            {JSON.stringify(health, null, 2)}
          </pre>
        )}
      </section>

      <section className="border-border bg-card space-y-3 rounded-xl border p-6">
        <h2 className="text-muted-foreground text-sm font-medium">
          Client path (Axios → BFF proxy)
        </h2>
        <HealthBadge />
      </section>
    </main>
  );
}
