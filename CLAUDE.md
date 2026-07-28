# CLAUDE.md — docs-hub-web

Context for Claude Code sessions working in this repository. Read this first, then
`docs/folder-structure.md` for the directory-by-directory reference.

## What this is

Enterprise frontend for **Document Hub**, an internal document-management platform.
Greenfield, built to be a foundation for a 20+ engineer team. This is an **independent
repo** — it deliberately does **not** follow the `am-project` ISC/GitLab conventions
(codebase language is **English**, CI is **GitHub Actions**, not GitLab).

## Stack

- **Next.js 16** (App Router) · **React 19** · **TypeScript** (strict)
- **Tailwind CSS 4** (CSS-first — there is **no** `tailwind.config.js`) · **shadcn/ui** · Radix · Lucide
- **Zustand** (ephemeral UI state only) · **TanStack Query** (server state)
- **React Hook Form** + **Zod** (Zod is the single source of truth for types & validation)
- **Axios** (client-only transport) · **next-intl** (i18n) · **Recharts** · dayjs · lodash-es
- Testing: **Jest** + RTL + **Playwright** + **MSW**
- Node **≥ 20** (see `.nvmrc` → 22). Package manager: **npm**.

## Architecture — Feature-based Clean Architecture

```
src/
  app/        App Router routes only (thin — no business logic)
  core/       cross-cutting infrastructure (env, auth, api transport, i18n, observability)
  shared/     reusable, feature-agnostic building blocks (ui kit, hooks, utils, providers)
  features/   self-contained vertical slices (auth, documents, …)
```

**Golden rules**

1. **Business logic never lives in UI components.** It lives in a feature's `services/`
   (domain) or `hooks/` (React binding). Components render; they don't decide.
2. **Zod schemas are the source of truth.** TS types are `z.infer<...>`. Never hand-write
   a type that duplicates a schema. MSW mock data is built from the same schemas.
3. **BFF auth model.** The browser only ever calls same-origin `/api/*` route handlers,
   which attach the JWT server-side and proxy to the backend. Tokens live in
   **httpOnly/secure/sameSite cookies** — never `localStorage`, never readable by JS.
   The client never performs token refresh (the server does).
4. **Axios is client-only.** ESLint forbids importing `axios` from `core/`, `middleware.ts`,
   route handlers, and RSC — those use `fetch` / `serverFetch`. Don't fight the lint rule;
   it's a load-bearing architecture guardrail.
5. **State goes to exactly one place:** server data → TanStack Query; ephemeral UI state
   (sidebar, command palette, multi-select) → Zustand; shareable state (filters, pagination,
   sort) → URL `searchParams`. Never mirror server data into a Zustand store.

## The documents slice is the canonical pattern

`features/documents/` is the reference implementation every new feature copies:
`schemas → api (transport/DTO) → services (domain mapping, only when it earns its keep)
→ hooks (queryOptions shared by RSC prefetch + client useQuery) → components`. A service
that would be a one-line passthrough is omitted; the hook calls `api` directly. Read that
slice before adding a new one.

## Conventions

- **Imports:** absolute via `@/*` → `src/*`. Barrel exports (`index.ts`) at feature and
  shared boundaries. Type imports use inline `import { type X }`.
- **Naming:** files `kebab-case` (`use-documents.ts`, `theme-toggle.tsx`); React components
  `PascalCase`; hooks `useXxx`; Zod schemas `XxxSchema`, inferred type `Xxx`.
- **Styling:** compose classes with `cn()` from `@/shared/lib/utils`. Use semantic design
  tokens (`bg-background`, `text-muted-foreground`, `--color-status-*`), not raw hex.
  Dark mode is class-based via `next-themes`; support both themes.
- **Commits:** Conventional Commits, enforced by commitlint — `type(scope): subject`
  (e.g. `feat(documents): add upload progress`). scope is kebab-case.
- **i18n:** no hardcoded UI strings — all copy goes through next-intl `messages/{en,vi}.json`.

## Commands

```bash
nvm use                 # switch to Node 22 (required — default shell may be Node 18)
npm run dev             # dev server on :3000
npm run build           # production build (output: standalone)
npm run typecheck       # tsc --noEmit
npm run lint            # eslint
npm run format          # prettier --write
```

Run `typecheck` + `lint` before considering any change done; both must be clean.

## Build status (module-by-module)

Delivered incrementally; each module boots + typechecks on its own. See
`docs/folder-structure.md` for what each planned directory will hold.

- [x] **Module 1 — Foundation:** config, Tailwind 4 tokens, theme provider, `env.ts`, CSP.
- [ ] Module 2 — i18n shell (`[locale]` routing, middleware, messages)
- [ ] Module 3 — HTTP + MSW spine (Axios client, BFF proxy, QueryProvider, mocks)
- [ ] Module 4 — Auth (JWT cookie, single-flight refresh, login)
- [ ] Module 5 — RBAC (`hasPermission`, `<Can>`, `requirePermission`)
- [ ] Module 6 — Documents read slice
- [ ] Module 7 — Documents write + `@modal` intercepting preview + charts
- [ ] Module 8 — UI kit, testing, observability, Docker, CI, docs

## Gotchas

- **Node version:** the machine default may be Node 18; the project needs ≥ 20. `nvm use` first.
- **Husky** hooks activate only after `git init` (repo isn't initialized yet).
- **Tailwind 4 is CSS-first** — design tokens and `@theme` live in `src/app/globals.css`.
  Do not add a `tailwind.config.js`; the shadcn CLI is configured for v4 mode.
- Never write `*/` inside a CSS comment (it closes the comment early) — bit us once already.
