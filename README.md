# Document Hub — Web

Enterprise frontend for **Document Hub**, an internal document-management platform.
Built on Next.js 16 App Router with a feature-based clean architecture, designed as a
foundation a 20+ engineer team can extend safely.

**Stack:** Next.js 16 · React 19 · TypeScript (strict) · Tailwind CSS 4 (CSS-first) ·
shadcn/ui · Radix · TanStack Query · Zustand · React Hook Form + Zod · MSW

---

## Status

Delivered **module by module** — each module boots and typechecks on its own.

- [x] **Module 1 — Foundation:** config, Tailwind 4 design tokens, theme provider, Zod-validated env, CSP & security headers, lint/format/commit tooling.
- [x] **Module 3 — HTTP + MSW spine:** client Axios + BFF proxy (`/api/[...proxy]`), server-fetch, TanStack Query, MSW mock server, `/status` demo. _(Module 2 i18n skipped — single-language app.)_
- [x] **Module 4 — Auth:** JWT in httpOnly cookies, single-flight refresh, middleware, RHF+Zod login, protected `/account`. Demo login: `admin@docs-hub.local` / `Password123!`.
- [ ] Module 5 — RBAC (`hasPermission`, `<Can>`, `requirePermission`)
- [ ] Module 6 — Documents read slice
- [ ] Module 7 — Documents write + `@modal` intercepting preview + charts
- [ ] Module 8 — UI kit, testing, observability, Docker, CI, docs

> The app currently renders a themed foundation page. Real routes and data flow arrive from Module 2 onward.

---

## Quick start

**Prerequisites:** Node **≥ 20** (the repo pins **22** via `.nvmrc`) and npm.

```bash
# 1. Use the right Node version (the machine default may be Node 18 — this matters)
nvm use

# 2. Install dependencies
npm install

# 3. Create your local env file from the template
cp .env.example .env.local

# 4. Enable git hooks (husky) — only needed once, after cloning
npm run prepare

# 5. Start the dev server + mock API together (recommended)
npm run dev:mock      # Next on :3000  +  MSW mock backend on :4000

# …or just the app (data calls will fail until a backend is on API_URL)
npm run dev
```

Open **http://localhost:3000**. Visit **/status** to see the API transport spine
(both the server and client paths) hitting the mock backend.

> **Gotcha:** if `npm run build` fails with `Cannot find module './tailwindcss-oxide.*.node'`,
> you installed under the wrong Node version. Run `nvm use` and reinstall.

---

## Scripts

| Script                 | What it does                                  |
| ---------------------- | --------------------------------------------- |
| `npm run dev`          | Start the dev server on `:3000`               |
| `npm run build`        | Production build (`output: standalone`)       |
| `npm run start`        | Serve the production build                     |
| `npm run typecheck`    | `tsc --noEmit` — must be clean                |
| `npm run lint`         | ESLint (flat config) — must be clean          |
| `npm run lint:fix`     | ESLint with autofix                           |
| `npm run format`       | Prettier write                                |
| `npm run format:check` | Prettier check (CI-friendly)                  |
| `npm run prepare`      | Install husky git hooks                        |

Run `typecheck` + `lint` before considering any change done; both must pass.

---

## Architecture

Feature-based Clean Architecture — four layers under `src/`, dependencies pointing inward:

```
src/
  app/        App Router routes only (thin — no business logic)
  core/       cross-cutting infrastructure (env, auth, api transport, i18n, observability)
  shared/     reusable, feature-agnostic building blocks (ui kit, hooks, utils, providers)
  features/   self-contained vertical slices (auth, documents, …)
```

**Golden rules**

1. **Business logic never lives in UI components** — it lives in a feature's `services/` (domain) or `hooks/` (React binding).
2. **Zod schemas are the source of truth** — TS types are `z.infer<...>`; MSW mock data is built from the same schemas.
3. **BFF auth model** — the browser only calls same-origin `/api/*` route handlers, which attach the JWT server-side. Tokens live in **httpOnly/secure/sameSite cookies**, never `localStorage`.
4. **Axios is client-only** — server code (`core/`, `middleware.ts`, route handlers, RSC) uses `fetch`; ESLint enforces this.
5. **One home per state** — server data → TanStack Query; ephemeral UI state → Zustand; shareable state (filters, pagination) → URL `searchParams`.

`features/documents/` is the canonical reference slice every new feature copies.

📖 Full directory reference: [`docs/folder-structure.md`](./docs/folder-structure.md) ·
Contributor context: [`CLAUDE.md`](./CLAUDE.md)

---

## Conventions

- **Imports:** absolute via `@/*` → `src/*`; barrel `index.ts` at feature/shared boundaries.
- **Naming:** files `kebab-case`; React components `PascalCase`; hooks `useXxx`; Zod schemas `XxxSchema` with inferred type `Xxx`.
- **Styling:** compose classes with `cn()` from `@/shared/lib/utils`; use semantic design tokens (`bg-background`, `--color-status-*`), not raw hex. Dark mode is class-based via `next-themes`.
- **Commits:** [Conventional Commits](https://www.conventionalcommits.org/), enforced by commitlint — `type(scope): subject` (e.g. `feat(documents): add upload progress`). Scope is kebab-case.
- **i18n:** out of scope — the app is single-language (English).

---

## Environment variables

Copy `.env.example` → `.env.local` and adjust. Values are validated at startup by
`src/core/config/env.ts` (a bad config fails fast).

| Variable                | Default                  | Description                                             |
| ----------------------- | ------------------------ | ------------------------------------------------------- |
| `APP_ENV`               | `local`                  | Runtime label: `local` / `development` / `staging` / `production` |
| `API_URL`               | `http://localhost:4000`  | Upstream backend the BFF proxy forwards to (server-only) |
| `ENABLE_MOCKS`          | `true`                   | Toggle in-process MSW mocking (Module 3+)               |
| `NEXT_PUBLIC_APP_NAME`  | `Document Hub`           | Public app name (inlined into the client bundle)        |
| `NEXT_PUBLIC_APP_ENV`   | `local`                  | Public env label                                        |
| `AUTH_SECRET`           | —                        | 32+ char secret for cookie/session crypto (Module 4)    |
| `JWT_ISSUER` / `JWT_AUDIENCE` | —                  | JWT verification config (Module 4)                      |

> Never commit real secrets. `.env*.local` is gitignored; only `.env.example` is tracked.

---

## Contributing

1. Branch from `main`: `git checkout -b feat/<scope>-<short-description>`.
2. Keep `typecheck`, `lint`, and `format:check` green.
3. Commit using Conventional Commits (commitlint runs on `commit-msg`).
4. Open a PR against `main`.

---

## License

Internal / proprietary — © FPT. All rights reserved.
