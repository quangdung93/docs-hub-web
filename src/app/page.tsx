import { FileText } from 'lucide-react';

import { ThemeToggle } from '@/shared/components/theme-toggle';

/**
 * Foundation smoke page (Module 1). Proves Tailwind 4 tokens, dark mode, and the
 * provider tree render. Replaced by the localized landing/dashboard in later modules.
 */
export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col items-center justify-center gap-8 px-6 text-center">
      <span className="bg-primary text-primary-foreground inline-flex size-16 items-center justify-center rounded-2xl">
        <FileText className="size-8" />
      </span>

      <div className="space-y-3">
        <h1 className="text-4xl font-semibold tracking-tight">Document Hub</h1>
        <p className="text-muted-foreground text-balance">
          Enterprise Next.js foundation — Module 1 (Foundation) is live. Tailwind 4 design tokens,
          dark mode, and the provider tree are wired up.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        {(['draft', 'in-review', 'approved', 'archived'] as const).map((status) => (
          <span
            key={status}
            className="border-border inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm capitalize"
          >
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: `var(--color-status-${status})` }}
            />
            {status.replace('-', ' ')}
          </span>
        ))}
      </div>

      <ThemeToggle />
    </main>
  );
}
