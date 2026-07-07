# Database Design

Postgres 16 + Prisma. The **canonical schema is `apps/api/prisma/schema.prisma`** — this doc explains the why; the schema file is the truth.

## Conventions

- IDs: `cuid()` strings (URL-safe, non-enumerable — never sequential ints on user-facing resources).
- Every table: `createdAt`, `updatedAt`. Soft delete (`deletedAt`) only where data has legal/recovery value (documents, users); hard delete elsewhere.
- All user-owned rows carry `userId` FK; queries always filter by it (enforced in services).
- Enums for closed sets (visa types, application stages, document types) — cheap integrity.

## Entity groups

### Identity
- **User** — auth identity + profile basics. `passwordHash` nullable (OAuth-only accounts). `role` enum (STUDENT, ADMIN) for RBAC.
- **OAuthAccount** — (provider, providerAccountId) unique; links Google to a User.
- **RefreshToken** — hashed token, `familyId` for rotation-reuse detection, `revokedAt`, `expiresAt`, device metadata.
- **StudentProfile** — 1:1 with User. University FK, degree level, major, `programStartDate`, `programEndDate`, `visaType`, entry date, SEVIS id (encrypted at app layer). Separated from User so auth stays lean and profile can grow.

### Reference
- **University** — name, slug, city/state, ISS office info. Seeded; users pick from it (free-text fallback field for unlisted schools).

### Immigration
- **Deadline** — `source` enum (SYSTEM_GENERATED | USER_CREATED | DOCUMENT_EXPIRY), `type` enum (VISA_EXPIRY, I20_EXPIRY, OPT_WINDOW_OPEN, OPT_FILING_DEADLINE, TRAVEL_SIGNATURE, CUSTOM, …), `dueDate`, `ruleVersion` (ADR-008), `dismissedAt`. System-generated rows carry a `dedupeKey` (unique per user+type+basis) so recomputation upserts instead of duplicating.
- **NotificationLog** — unique `(deadlineId, checkpoint)`; idempotent reminder sends.
- Timeline milestones are **computed, not stored** — pure function of profile dates + rules. Storing them would create sync bugs. Only deadlines (which need reminder state) persist.

### Documents
- **Document** — `type` enum (PASSPORT, VISA_STAMP, I20, I94, EAD, DRIVERS_LICENSE, INSURANCE, LEASE, TAX, OFFER_LETTER, OTHER), `storageKey`, `status` (PENDING | ACTIVE | DELETED), size, contentType, `issueDate`, `expiryDate` (feeds Deadline generation), soft delete. OCR text column reserved (`extractedText`, nullable) for Phase 2 search.

### Career
- **Company** — global table (shared across users): name, website, domain unique. Phase 2 adds sponsorship columns (`h1bHistory`, `acceptsCpt/Opt`, `everify`) fed by public LCA data ingestion — designed now so applications can link to it from day one.
- **Application** — userId, companyId (nullable + free-text `companyName` fallback so adding an application is never blocked on company lookup), role title, `stage` enum (SAVED, APPLIED, OA, INTERVIEW, OFFER, REJECTED, WITHDRAWN), dates per stage transition via **ApplicationEvent** rows (audit trail powers "time in stage" analytics later), url, salary fields, `sponsorshipConfirmed` tri-state, notes.

### Phase-2 tables present in schema now (empty until built)
- **AiConversation / AiMessage** — chat history, `model`, token counts.
- **Task** — dashboard checklist.
- Rationale: adding tables later is easy; what we're buying is FK shape agreement now (e.g., Application ↔ Company) so Phase 1 code doesn't need rework.

### Deliberately NOT in schema yet
Marketplace, community, events, subscriptions/payments. Designing tables for unvalidated features is speculation debt. When Phase 3 starts, they get their own migration + ADR.

## Indexing (beyond PKs/uniques)
- `Deadline (userId, dueDate)` — dashboard "next deadlines" query.
- `Application (userId, stage)` — kanban board.
- `Document (userId, type)` and partial index on `expiryDate IS NOT NULL`.
- `RefreshToken (familyId)`, `(tokenHash)` unique.

## Data protection
- SEVIS ID and passport number fields: AES-256-GCM encrypted at the application layer (key from env/KMS), never logged.
- Postgres at rest encryption via RDS default.
- User deletion = soft delete + 30-day purge job (documents removed from S3 in the purge).
