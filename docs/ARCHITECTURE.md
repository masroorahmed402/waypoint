# Waypoint — System Architecture

**Status:** Accepted · **Date:** 2026-07-06 · See DECISIONS.md for the ADRs behind each choice.

## 1. Shape of the system

**Modular monolith, monorepo, two deployables.** Not microservices. (ADR-001.)

```
┌────────────────────────────────────────────────────────┐
│  Browser                                               │
└───────────────┬────────────────────────────────────────┘
                │ HTTPS
┌───────────────▼──────────────┐
│  apps/web  — Next.js 14+     │  App Router, RSC where useful,
│  (Vercel or ECS)             │  client components for interactivity
└───────────────┬──────────────┘
                │ REST /api/v1 (JSON, JWT bearer)
┌───────────────▼──────────────────────────────────────┐
│  apps/api — NestJS (modular monolith)                │
│                                                      │
│  auth │ users │ immigration │ documents │ career     │
│  storage │ notifications(P2) │ ai(P2) │ health       │
│                                                      │
│  Cross-cutting: guards, rate limit, validation,      │
│  audit interceptor, exception filter                 │
└──────┬───────────────┬───────────────┬───────────────┘
       │               │               │
┌──────▼─────┐  ┌──────▼─────┐  ┌──────▼──────────────┐
│ PostgreSQL │  │   Redis    │  │ S3 (presigned URLs, │
│  (Prisma)  │  │ cache +    │  │ private bucket)     │
│            │  │ rate limit │  │                     │
└────────────┘  └────────────┘  └─────────────────────┘
```

Everything runs in Docker locally via `docker-compose`. Production target: AWS (ECS Fargate for api, Vercel or ECS for web, RDS Postgres, ElastiCache Redis, S3). Don't build the AWS deploy until there are users; docker-compose on a single EC2/Lightsail box is fine for the first 500 users.

## 2. Backend architecture (apps/api)

NestJS modular monolith. Each domain module owns its controllers, services, and DTOs. Modules communicate **only through service interfaces** (constructor injection), never by reaching into each other's tables through raw queries. This keeps the door open to extracting a service later without ever paying the microservices tax now.

```
src/
├── main.ts                  # bootstrap: helmet, CORS, global pipes/filters, versioning
├── app.module.ts
├── config/                  # typed env config (validated at boot — fail fast)
├── prisma/                  # PrismaService (single client, shutdown hooks)
├── common/
│   ├── guards/              # JwtAuthGuard (global), RolesGuard
│   ├── decorators/          # @Public(), @CurrentUser(), @Roles()
│   ├── filters/             # global exception filter → consistent error envelope
│   └── interceptors/        # audit logging
└── modules/
    ├── auth/                # register, login, refresh, Google OAuth, logout
    ├── users/               # profile, onboarding data
    ├── immigration/         # timeline computation, deadlines
    ├── documents/           # vault metadata; delegates bytes to storage
    ├── career/              # applications, companies (P2: sponsorship data)
    ├── storage/             # S3 abstraction (LocalDiskStorage for dev — ADR-004)
    └── health/              # /health for load balancers
```

**Key backend rules**
- Controllers are thin: validate (class-validator DTOs), call service, return. No business logic in controllers.
- Services own business logic and are the only layer that touches Prisma.
- All list endpoints paginate (cursor-based) from day one.
- Every mutation is scoped by `userId` from the JWT — never trust IDs in the body for ownership.
- Global `ValidationPipe` with `whitelist: true, forbidNonWhitelisted: true` — unknown fields are rejected, killing mass-assignment bugs.

## 3. Frontend architecture (apps/web)

Next.js App Router. Server components for static/read-heavy pages; client components for the interactive surfaces (kanban board, timeline, upload). Data layer is a thin typed fetch wrapper (`src/lib/api.ts`) + TanStack Query for client-side caching/mutations. Auth: httpOnly refresh cookie + in-memory access token (ADR-003). shadcn/ui + Tailwind; no component library lock-in beyond that.

Route groups:
```
/(auth)    login, register, oauth callback
/(app)     dashboard, immigration, documents, applications, settings   ← authed layout
```

## 4. Authentication flow (ADR-003)

- **Access token**: JWT, 15 min, held in memory on the client (never localStorage).
- **Refresh token**: opaque random 256-bit value, httpOnly + Secure + SameSite=Lax cookie, hashed (SHA-256) at rest, rotated on every use, family-revoked on reuse detection.
- Google OAuth (passport-google-oauth20) produces the same session pair; account linking by verified email.
- Logout revokes the refresh token server-side.

## 5. File storage strategy (ADR-004)

Documents never transit the API server. Flow:
1. Client asks `POST /documents` → API validates type/size, creates DB row (`status=PENDING`), returns **presigned S3 PUT URL** (60s TTL).
2. Client PUTs directly to S3.
3. Client confirms `POST /documents/:id/confirm` → API HEADs the object, verifies size/content-type, sets `status=ACTIVE`.
4. Reads use presigned GET URLs (short TTL). Bucket is fully private; no public objects, ever.

Dev mode uses a `LocalDiskStorage` implementing the same `StorageService` interface so nobody needs AWS credentials to contribute.

## 6. Immigration timeline engine

The differentiating logic. Pure, unit-testable function:

```
computeTimeline(profile: { programStart, programEnd, visaType, ... }) → Milestone[]
computeDeadlines(profile, documents) → Deadline[]
```

Rules live in versioned rule tables/config (e.g., "OPT filing window: 90 days before program end date through 60 days after"), **not** hardcoded scattered through services. When USCIS changes a rule, we change one file. Every generated deadline stores which rule version produced it (auditability — this matters because people make real decisions off these dates).

**Legal posture:** every immigration surface carries a persistent "informational only, not legal advice; confirm with your DSO" notice. This is not decoration; it's a product requirement.

## 7. Notifications (Phase 1: email only)

A `Deadline` row has `remindAt` checkpoints (90/30/7/1 days). A scheduled job (Nest `@Cron`, later BullMQ on Redis when volume demands) scans due reminders and sends via a provider abstraction (Resend or SES behind an `EmailService` interface). Idempotency: a `NotificationLog` unique constraint on `(deadlineId, checkpoint)` prevents double-sends.

## 8. AI integration strategy (Phase 2 — designed, not built)

- Provider-agnostic client (OpenAI-compatible interface, so other model providers can be swapped in).
- RAG over a **curated** corpus only: USCIS pages, ICE SEVP docs, university ISS pages — ingested, chunked, embedded into pgvector (stay in Postgres; no separate vector DB until scale forces it — ADR-006).
- Hard system-prompt constraints: cite sources, refuse case-specific legal advice, always point to DSO.
- Conversation history in the `AiConversation`/`AiMessage` tables already present in the schema.

## 9. Scalability posture

Honest sizing: 10k users of this product is a **small** load. One Postgres, one Redis, 2× stateless API containers behind an ALB handles it with headroom. The real scaling risks are:
- **Reminder job fan-out** → solved by moving cron → BullMQ queue when >10k deadlines/day.
- **S3 costs from unbounded uploads** → per-user quota (500 MB) enforced at presign time.
- **Sponsorship DB queries (P2)** → read-heavy, cache aggressively in Redis, consider read replica later.

What we deliberately did NOT build for: multi-region, microservices, Kafka, Kubernetes. Revisit at 100k users, not before.

## 10. Observability

- Structured JSON logs (pino) with request IDs.
- `/health` (liveness) + `/health/ready` (DB+Redis check).
- Sentry for both apps from day one (cheap, catches real bugs).
- Grafana/Prometheus deferred until there's infrastructure worth graphing; PostHog for product analytics in Phase 2.
