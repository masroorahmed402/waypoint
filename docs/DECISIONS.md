# Architecture Decision Records

Append-only. Never delete an ADR; supersede it.

---

## ADR-001: Modular monolith, not microservices

**Status:** Accepted · **Date:** 2026-07-06

**Context:** Proposal implies many "modules." Team size: 1–2. Users at launch: ~0.

**Options:**
| | Complexity | Cost | Time to market | Fits team |
|---|---|---|---|---|
| Microservices | High | High (per-service infra) | Slow | No |
| Modular monolith (NestJS modules) | Low-Med | Low | Fast | Yes |
| Serverless functions | Med | Low idle cost | Med | Poor local DX for this shape |

**Decision:** One NestJS app, strict module boundaries (services injected via interfaces, no cross-module table access). Extract a service later only when a module has a demonstrably different scaling profile.

**Consequences:** Single deploy, single DB migration stream, trivial local dev. Discipline required at module boundaries — enforced in code review.

---

## ADR-002: MVP = Immigration Center + Document Vault + Application Tracker

**Status:** Accepted · **Date:** 2026-07-06

See docs/MVP-SCOPE.md for full reasoning. Core logic: highest-stakes recurring pain (deadlines) + daily-use surface (applications) + data flywheel (documents feed deadlines). Marketplace/community deferred due to two-sided cold-start; AI deferred due to legal risk + corpus curation cost.

---

## ADR-003: Auth = short-lived JWT access + rotated opaque refresh token in httpOnly cookie

**Status:** Accepted · **Date:** 2026-07-06

**Context:** Proposal asked for "JWT + refresh tokens." The dangerous default is JWTs in localStorage.

**Decision:**
- Access: JWT (RS256-ready, HS256 in dev), 15 min TTL, in memory client-side.
- Refresh: 256-bit opaque token, httpOnly/Secure/SameSite=Lax cookie, SHA-256 hash stored, **rotation on every refresh**, token-family reuse detection → revoke whole family.
- Why opaque refresh instead of JWT refresh: server-side revocation actually works (logout, stolen-token response) without a denylist cache.

**Consequences:** XSS cannot exfiltrate the refresh token; CSRF surface limited to the refresh endpoint (mitigated by SameSite + origin check). Slightly more DB traffic on refresh — irrelevant at our scale.

---

## ADR-004: Storage behind an interface; presigned URLs; local-disk driver for dev

**Status:** Accepted · **Date:** 2026-07-06

Bytes never flow through the API (saves memory, bandwidth, and a whole class of upload vulnerabilities). `StorageService` interface with `S3Storage` and `LocalDiskStorage` implementations. Private bucket, SSE-S3 encryption at rest (KMS when we have paying users), presigned GET/PUT with short TTLs, per-user quota enforced at presign time, content-type + size verified on confirm.

---

## ADR-005: REST over GraphQL

**Status:** Accepted · **Date:** 2026-07-06

One first-party client, CRUD-shaped domain, team of 1–2. GraphQL's costs (N+1 policing, auth-per-field, caching complexity) buy nothing here. REST with consistent envelopes + OpenAPI (Nest Swagger) for free docs. Revisit if third-party API consumers (universities, Phase 3) need flexible querying.

---

## ADR-006: pgvector in Postgres, not a dedicated vector DB (Phase 2)

**Status:** Accepted (pre-emptive) · **Date:** 2026-07-06

The RAG corpus (curated immigration docs) will be tens of thousands of chunks, not billions. pgvector keeps one database, one backup story, transactional consistency with metadata. Pinecone/Weaviate/Qdrant only if corpus or QPS outgrows it.

---

## ADR-007: pnpm workspaces monorepo; no Nx/Turborepo yet

**Status:** Accepted · **Date:** 2026-07-06

Two apps, one shared types package later. pnpm workspaces is enough. Add Turborepo when build times hurt, which is not now.

---

## ADR-008: Immigration rules as versioned data, not scattered code

**Status:** Accepted · **Date:** 2026-07-06

Deadline math (OPT windows, grace periods, travel-signature validity) changes when policy changes and differs by visa type. Rules live in one typed rules module with version identifiers; every generated deadline records its rule version. Enables: auditing why a date was shown, safe rule updates, and future non-US expansion without rewrites.

---

## ADR-009 (rejected idea): Building resume builder / ATS scorer in MVP

**Status:** Rejected · **Date:** 2026-07-06

Crowded market, weak differentiation, large surface area. The application *tracker* is in; the *builder* is out until users pull for it.
