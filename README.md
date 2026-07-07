# Waypoint

An operating system for international students: immigration timeline with automated deadline reminders, a secure document vault, and a job-application tracker — from admission letter through graduation.

This repository is the **M0 foundation**: full documentation, a working NestJS API (auth, immigration rules engine, documents, applications), and a Next.js web app. See `docs/` for the thinking behind every decision.

## Read this first

- `docs/MVP-SCOPE.md` — what's in the MVP and what's deliberately deferred (start here)
- `docs/ARCHITECTURE.md` — system shape and module boundaries
- `docs/DECISIONS.md` — the ADRs (auth, storage, rules-as-data, etc.)
- `docs/DATABASE.md`, `docs/API.md`, `docs/SECURITY.md`, `docs/ROADMAP.md`

## Stack

Next.js 14 (App Router) · NestJS 10 · PostgreSQL + Prisma · Redis · S3 (abstracted) · Docker.
pnpm workspaces monorepo: `apps/api` and `apps/web`.

## Prerequisites

- Node.js 20+
- pnpm 9 (`corepack enable`)
- Docker (for Postgres + Redis)

## Setup

```bash
# 1. Environment
cp .env.example .env
#    then generate real secrets:
#      openssl rand -base64 48   → JWT_ACCESS_SECRET
#      openssl rand -hex 32      → FIELD_ENCRYPTION_KEY
#    (Google OAuth + S3 are optional; STORAGE_DRIVER defaults to "local")

# 2. Infrastructure
docker compose up -d          # postgres + redis

# 3. Install
pnpm install

# 4. Database
pnpm --filter @iso/api prisma:generate
pnpm db:migrate               # creates the schema
pnpm db:seed                  # seeds universities (DePaul first)

# 5. Run (two processes, or `pnpm dev` for both)
pnpm dev:api                  # http://localhost:4000  (Swagger at /api/docs)
pnpm dev:web                  # http://localhost:3000
```

The API needs its `.env`; the web app reads `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:4000/api/v1`). If you keep a single root `.env`, the API loads it automatically; for the web app, copy the `NEXT_PUBLIC_*` line into `apps/web/.env.local`.

## What works right now

- Register / login / logout, Google OAuth, refresh-token rotation with reuse detection
- Onboarding → auto-computed F-1 timeline + system deadlines (OPT window, grace period, travel signature)
- Document vault upload flow (presigned URLs; local-disk driver in dev, S3 in prod)
- Application tracker with a kanban board and stage history

## Tests

```bash
pnpm --filter @iso/api test   # includes the F-1 rules-engine unit tests
```

## Notes for continued development

- The immigration rules live in one file: `apps/api/src/modules/immigration/f1.rules.ts`. Bump `RULE_VERSION` when policy changes; every generated deadline records the version that produced it.
- The local storage driver needs a small dev-only upload endpoint to be wired if you want end-to-end uploads without S3 (see `local.storage.ts`); with `STORAGE_DRIVER=s3` and a bucket, the presigned flow works as-is.
- Email reminders (M5) are scoped in the roadmap but not yet implemented — the `NotificationLog` table and checkpoints are ready for the cron job.

Everything here is **informational only, not legal advice** — the product surfaces this on every immigration screen, and so should any feature you add.