# Folder Structure

Directory-by-directory reference for `document-hub-web`. The architecture is
**Feature-based Clean Architecture**: four top-level layers under `src/`, with
dependencies always pointing **inward** (`features → shared → core`; `app` wires
them together). Nothing in `core/` or `shared/` may import from `features/`.

> Legend: **[present]** exists today · **[planned]** arrives in a later module.

## Top level

```
document-hub-web/
├── src/                    Application source (see below)
├── docs/                   Project documentation (this file, conventions, diagrams)
├── messages/       [planned] next-intl translation catalogs (en.json, vi.json)
├── public/         [planned] static assets served as-is
├── .husky/                 Git hooks (pre-commit → lint-staged, commit-msg → commitlint)
├── CLAUDE.md               Session context for Claude Code
├── components.json         shadcn/ui config (Tailwind v4 mode; aliases → @/shared/*)
├── next.config.ts          Standalone output, CSP & security headers, image config
├── eslint.config.mjs       ESLint 9 flat config (+ axios-in-server guardrail)
├── .prettierrc.json        Prettier + tailwind class-sorting plugin
├── commitlint.config.mjs   Conventional Commits rules
├── tsconfig.json           strict TS, `@/*` → `src/*` path alias
└── .env.example / .env.local   Environment templates (validated by core/config/env.ts)
```

## `src/app/` — routing layer (thin)

App Router routes **only**. Pages and layouts compose feature components and call
services/loaders — they hold **no business logic**. This keeps routing concerns
(metadata, streaming, boundaries) separate from domain logic.

```
src/app/
├── layout.tsx              [present] root layout (providers, <html>, global metadata)
├── page.tsx                [present] foundation smoke page (temporary)
├── globals.css             [present] Tailwind 4 import + design tokens (@theme, oklch)
├── [locale]/       [planned] locale segment — real pages live here (Module 2)
│   ├── (public)/   [planned] route group: login, landing (unauthenticated)
│   ├── (app)/      [planned] route group: authenticated shell (sidebar, navbar)
│   │   ├── @modal/ [planned] parallel slot for intercepting document preview
│   │   └── documents/ [planned] list, [id] detail, upload
│   ├── layout.tsx  [planned] locale-aware <html lang>, next-intl provider
│   ├── loading.tsx / error.tsx / not-found.tsx / forbidden.tsx  [planned] UI boundaries
└── api/            [planned] BFF route handlers
    ├── [...proxy]/ [planned] catch-all proxy: attaches JWT, forwards to backend
    ├── auth/       [planned] login / logout / refresh
    └── health/     [planned] liveness probe
```

Route groups `(public)` / `(app)` partition auth boundaries without adding URL
segments. The `@modal` parallel route + `(.)` interception give a shareable
document-preview dialog that preserves the list's scroll/filter/selection state.

## `src/core/` — cross-cutting infrastructure

Framework-level plumbing shared by every feature. Depends on nothing above it.
This is where the "how the app talks to the outside world" lives.

```
src/core/
├── config/
│   └── env.ts              [present] Zod-validated env (server vs client schemas, fail-fast)
├── api/            [planned] transport primitives
│   ├── http.ts     [planned] client Axios instance (baseURL /api, withCredentials)
│   ├── server-fetch.ts [planned] server-side fetch that reads the auth cookie
│   └── errors.ts   [planned] normalized AppError + response envelope helpers
├── auth/           [planned] session, single-flight refresh, permissions
│   ├── session.ts  [planned] getSession() — jose JWT verify, request-cached
│   ├── refresh.ts  [planned] single-flight token refresh (grace-window rule)
│   ├── permissions.ts [planned] isomorphic hasPermission() / hasAny()
│   └── require.ts  [planned] requirePermission() for server components
├── i18n/           [planned] next-intl request config, locales, routing
└── observability/  [planned] Sentry, OpenTelemetry, GA, structured logging
```

## `src/shared/` — reusable, feature-agnostic building blocks

Things any feature can use, that carry no domain knowledge. If it mentions
"document" or "user", it belongs in a feature, not here.

```
src/shared/
├── ui/             [planned] shadcn/ui + semantic wrappers (Button, Input, Modal,
│                             Drawer, Toast, Table, Pagination, Tabs, Sidebar, …)
├── components/
│   └── theme-toggle.tsx    [present] light/system/dark switch
├── providers/
│   ├── index.tsx          [present] AppProviders composition point
│   ├── theme-provider.tsx [present] next-themes wrapper (class strategy)
│   └── query-provider.tsx [planned] TanStack Query client + devtools
├── hooks/          [planned] generic hooks (useDebounce, useMediaQuery, …)
├── lib/
│   └── utils.ts           [present] cn() class merger (clsx + tailwind-merge)
└── forms/          [planned] RHF + Zod form primitives (Form, Field, FormMessage)
```

## `src/features/<slice>/` — vertical slices

Each feature is **self-contained** and independently ownable by a sub-team. A slice
only exposes what other code needs via its barrel `index.ts`; internals stay private.
Not every folder is mandatory — create one only when it has real content (e.g. omit
`services/` when the api layer needs no domain mapping).

```
src/features/documents/     [planned] the canonical reference slice
├── schemas/        Zod schemas — the source of truth for types & validation
├── types/          (usually unnecessary) types not derivable from schemas
├── api/            transport: one function per endpoint, DTO in/out, validates responses
├── services/       domain: DTO → domain model mapping, multi-call orchestration
├── hooks/          React binding: queryOptions, useQuery/useMutation, Zustand UI stores
├── components/     presentational + container components for this feature
├── constants/      feature-local constants & enums
├── utils/          feature-local pure helpers
└── routes/         typed route builders / path constants for this feature
```

**Data-flow through a slice (read path):**

```
schema (Zod)  →  api (fetch + parse DTO)  →  service (map to domain)  →  hook (queryOptions)  →  component
```

The **write path** adds mutations in `hooks/` with cache invalidation and optimistic
updates. `auth/` is the second slice and follows the same shape at a smaller scale.

## `src/mocks/` — MSW mock layer [planned]

One set of request handlers, three runtimes, so mocks stay in sync across every test
and dev environment.

```
src/mocks/
├── handlers/       single source of truth for mocked endpoints
├── db.ts           @mswjs/data in-memory database, seeded from schemas + faker
├── server.ts       setupServer(...)  → Jest (node)
├── browser.ts      setupWorker(...)  → dev in the browser (optional)
└── standalone.ts   HTTP server on :4000 → Playwright & the BFF's server-side fetch
```

## Import & dependency rules

- **Allowed:** `features → shared → core`. `app` may import from all three.
- **Forbidden:** `core → shared`, `core → features`, `shared → features`,
  `features/a → features/b` internals (go through the barrel `index.ts` only).
- **Absolute imports** via `@/*`; no deep relative `../../..` across layers.
- **Axios** may be imported only from client components — never `core/`, `middleware.ts`,
  route handlers, or RSC (enforced by ESLint `no-restricted-imports`).
