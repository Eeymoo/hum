# AGENTS.md

Repo-specific guidance for OpenCode sessions. Read before editing. When in doubt, omit — generic conventions are not listed here.

## Monorepo layout

npm workspaces with two packages:
- `packages/web` (`@hum/web`) — Next.js 15 app: REST API under `app/api/v1/`, dashboard UI under `app/dashboard/`, Prisma schema at `prisma/schema.prisma`. Entry: `next dev` / `next start`.
- `packages/cli` (`@eeymoo/hum`, published to npm) — ESM Node CLI (`"type": "module"`, plain JS, no compile step). Entry: `bin/index.js`, commands in `src/commands/*.js`.

Run scoped commands with `npm run <script> -w @hum/web` / `-w @eeymoo/hum`, or `cd` into the package.

## Prisma dual-DB system — biggest gotcha

This app supports both SQLite (dev) and PostgreSQL (prod) off a **single** schema. The provider is selected at runtime:

- `scripts/prisma-switch.js` (run automatically before every `dev`/`build`/`prisma:*` task) **rewrites `prisma/schema.prisma`'s `provider =` line** based on the `DB_TYPE` env var (`sqlite` default, `postgresql` for prod), then copies `migrations_<dbtype>/` into `migrations/`.
- Therefore: **do not hand-edit the `provider =` line in `schema.prisma`** — it will be overwritten. Do not edit `prisma/migrations/` — it is gitignored and generated. The source-of-truth migration dirs are `prisma/migrations_sqlite/` and `prisma/migrations_postgresql/`.
- When changing the schema, you typically must create parallel migrations in **both** `migrations_sqlite/` and `migrations_postgresql/`. Switch provider by setting `DB_TYPE` and running `npm run prisma:migrate -w @hum/web`.
- Set `DB_TYPE=postgresql` in `.env` to develop against Postgres locally.

## Commands

Web (`packages/web`):
- `npm run dev` — dev server on :3000
- `npm run build` — Next.js standalone build (`output: "standalone"`)
- `npm run lint` — `next lint` (no separate eslint config file; uses `eslint-config-next`)
- `npm run test` — `vitest run` (jsdom env, setup in `__tests__/setup.ts`, tests under `__tests__/`)
- `npm run prisma:generate|migrate|studio|push|pull` — all pre-run the provider switch

CLI (`packages/cli`):
- `node bin/index.js` — run locally
- `npm run build` — smoke test (`--version`); the CLI ships as plain JS
- `npm run test:e2e` / `test:e2e:extended` / `test:e2e:full` — **shell-script E2E tests** in `test/*.sh`. They require a live API at `http://localhost:3001` with API key `abc123` pre-configured. There are no unit tests.

Root: `npm run dev` / `npm run build` fan out to both workspaces. `npm test` is a stub — run tests per package.

## Env vars (web)

Copy `packages/web/.env.example` to `.env`. Required for normal operation: `DATABASE_URL`, `AUTH_SECRET`/`NEXTAUTH_SECRET`, `NEXTAUTH_URL`. `SYNC_TOKEN_SECRET` gates the data-sync subsystem (Xiaomi health import) — missing it disables sync but won't crash the app.

## Sync subsystem

`packages/web/lib/sync/` implements third-party data import (notably Xiaomi / mi-crypto). It is bootstrapped from `instrumentation.ts` on `NEXT_RUNTIME === 'nodejs'` via an `initScheduler()` cron job. Failures during init are non-fatal by design. Don't move this init into request scope.

## Path alias

`@/*` maps to the `packages/web` root in both `tsconfig.json` and `vitest.config.ts`. Use `@/lib/...`, `@/app/...`.

## Auth

NextAuth.js v5 (beta). OAuth (GitHub/Google) + email/password on web; API-key and device-flow auth for the CLI (`lib/auth.ts`, `lib/device-auth.ts`). CLI/API auth is separate from web session auth.

## Release flow

Releases are tag-driven. Pushing `git tag v*.*.*` triggers `.github/workflows/release.yml`, which:
1. Publishes `packages/cli` to npm as `@eeymoo/hum` (provenance, public).
2. Builds and pushes `packages/web` to `ghcr.io/<owner>/hum-api:v<x>` and `:latest`.

The workflow syncs `package.json` versions from the tag automatically. Before tagging, use the repo-local `release-tag` skill to align the two `package.json` version fields first.

## OpenSpec

This repo uses OpenSpec (`openspec/`) for spec-driven changes. Repo-local skills live in `.opencode/skills/openspec-*` and slash commands in `.opencode/commands/`. Prefer the OpenSpec workflow for non-trivial features.

## Things that are NOT mistakes

- `schema.prisma` showing `provider = "postgresql"` or `"sqlite"` after a build/dev run is expected — the switch script did it.
- `prisma/migrations/` (no suffix) existing locally but not in git — it's generated and gitignored.
- CLI `package.json` `build` script only prints `--version` — it's a CI smoke check, not a compile.
