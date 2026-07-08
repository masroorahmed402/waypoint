# Waypoint — Security Audit

Read-only audit. No code was changed to produce this report. Severity: **Critical** (fix before any real student uses this) · **High** (fix before public beta) · **Medium** (should fix before beta) · **Low** (can wait).

---

## CRITICAL-1: Account takeover via unverified email + Google OAuth auto-linking

**Files:** `apps/api/src/modules/auth/auth.service.ts` — `register()` (lines 47-80), `loginWithGoogle()` (lines 156-177)

**What's wrong:** `register()` creates a `User` row from any email/password with **no email verification** — `emailVerifiedAt` is never set on this path (confirmed: it's grepped as written in exactly one place in the whole codebase, the Google-signup branch). `loginWithGoogle()` links to an existing account by email with no re-authentication:

```ts
user = await this.prisma.user.upsert({
  where: { email },
  update: {},              // ← if a user with this email already exists, just use it
  create: { email, ... emailVerifiedAt: new Date() },
});
await this.prisma.oAuthAccount.create({ data: { userId: user.id, provider: 'google', ... } });
```

**Exploit path:**
1. Attacker registers `victim@gmail.com` with a password they choose. Registration succeeds immediately — no confirmation email, no block. The account now holds a real, usable session.
2. The real victim, who owns `victim@gmail.com`, later signs up or logs in via "Continue with Google" — a legitimate, Google-verified flow.
3. `loginWithGoogle` finds no OAuth link yet, falls through to the `upsert`, matches the **existing (attacker-created) row by email**, silently attaches the victim's verified Google identity to it, and logs the victim into *the attacker's account*.
4. The victim, believing this is their account, uploads their I-20, passport, SEVIS ID. The attacker — who has known the password since step 1 — logs in with it and has full access to everything the victim just uploaded.

**Why it matters for this app specifically:** this isn't a generic account-mixup bug. The asset at stake is I-20s, passport numbers, SEVIS IDs, and visa documents for international students. This pattern gives an attacker a pre-positioned, invisible backdoor into any account whose owner later chooses "Sign in with Google," which is likely to be a large fraction of students given Google is the dominant email provider for university accounts.

**Fix:** Do not auto-link Google identities to existing password-based accounts. Options, cheapest first:
- On Google login, if the matched `User` has a `passwordHash` set and no existing `OAuthAccount`, do not silently attach — either reject with a "an account with this email already exists, log in with your password and link Google from Settings" message, or require the current password as part of an explicit linking step.
- Longer-term, correct fix: implement real email verification for password registration (send a verification link; require it before the account is considered trustworthy for linking purposes), and only permit Google to silently claim an *unverified* email's account (since Google's own verification is then the first real proof of ownership) — but only if no login has occurred on that account yet, or better, treat this as a security event and notify.

**Acceptance criteria:** register `victim@example.com` with password A; attempt Google sign-in as the "victim" (simulable with a test OAuth account or a unit test stubbing `GoogleUser`) — the flow must not silently return the password-created row without some ownership check.

**Before beta:** Yes. This is the single highest-priority fix in this audit.

---

## CRITICAL-2: Unauthenticated path traversal via dev-storage, reachable if `STORAGE_DRIVER` misconfigured in production

**Files:** `apps/api/src/modules/storage/dev-storage.controller.ts`, `apps/api/src/modules/storage/local.storage.ts` (`decodeStorageKey`, `writeRaw`, `readRaw`), `apps/api/src/config/app.config.ts` (`validateEnv`)

**What's wrong, two compounding issues:**

1. **No path validation.** `decodeStorageKey` base64url-decodes the `:seg` URL param straight into a filesystem path with zero validation. I confirmed this directly:
   ```
   base64url("../../../../etc/passwd") → decodes back to "../../../../etc/passwd"
   join(ROOT, key) → escapes .uploads-dev entirely
   ```
   `GET /api/v1/dev-storage/<that base64>` would attempt to read arbitrary files from the container filesystem and return them in the response body. `PUT` would let an attacker write arbitrary files. Both endpoints are `@Public()` — no auth token required at all.

2. **The claimed production protection doesn't exist.** The code comment on `LocalDiskStorage` says: *"NEVER used in production (config validation blocks STORAGE_DRIVER other than s3 there)."* This is not true. `validateEnv()` in `app.config.ts` only checks `if (env.STORAGE_DRIVER === 's3' && !env.S3_BUCKET) throw` — it never checks that `STORAGE_DRIVER` **must** be `'s3'` when `NODE_ENV=production`. If `STORAGE_DRIVER` is ever left unset in a production environment (it defaults to `'local'`), this becomes a live, unauthenticated, path-traversal-capable file read/write endpoint on your production API. The controller's own `ensureLocal()` runtime check is the *only* actual gate, and it trusts the same unenforced env var.

**Why it matters:** this is a textbook unauthenticated arbitrary file read/write primitive. In production that's container filesystem access (env files, potentially mounted secrets depending on deployment) or, at minimum, a way to write files anywhere the process has permissions. It costs nothing to exploit — no auth, no rate-limit bypass needed (the auth-specific throttles don't apply here since this isn't under `/auth`), just a crafted base64 segment.

**Fix (two parts, both needed):**
- Add a real validation to `decodeStorageKey` (or wherever it's consumed) rejecting any decoded key containing `..`, leading `/`, or resolving outside `ROOT` — normalize and check with `path.resolve` + a prefix check, don't trust string matching alone.
- Make `validateEnv()` actually enforce the comment's claim: in production, throw if `STORAGE_DRIVER !== 's3'`. This turns a silent misconfiguration into a boot-time failure, which is exactly the fail-fast pattern the rest of `validateEnv` already uses correctly for the JWT secret.

**Acceptance criteria:** a base64url-encoded `../`-containing key returns 400/404, not file contents, regardless of environment; booting with `NODE_ENV=production` and `STORAGE_DRIVER` unset (or `local`) throws at startup instead of silently serving traffic.

**Before beta:** Yes — even though today's deployment reportedly uses S3/R2 correctly, this is a landmine for the next redeploy, env var typo, or new environment (staging, etc.) that doesn't get every var right.

---

## High: single-origin CORS won't survive the domain move cleanly

**File:** `apps/api/src/main.ts:20`, `apps/api/src/config/app.config.ts` (`webOrigin`)

Already flagged in the Beta Readiness Report — repeating here because it's a security-adjacent config, not just UX. `enableCors({ origin: config.webOrigin, credentials: true })` accepts exactly one origin string. If `waypointf1.com` and `www.waypointf1.com` both resolve and only one is in `WEB_ORIGIN`, the other gets silently rejected. Not itself a vulnerability, but a fragile point in a security-relevant control — worth fixing with a canonical redirect rather than loosening CORS.

**Before beta:** Yes.

---

## Medium: `AuditInterceptor` is dead code — no request audit trail actually exists

**File:** `apps/api/src/common/interceptors/audit.interceptor.ts`

**What's wrong:** This interceptor logs `userId`/`method`/`path`/`ms` per request with a comment explicitly noting it avoids bodies/tokens/PII — genuinely well-designed. But it is never registered: no `app.useGlobalInterceptors(...)` in `main.ts`, no `APP_INTERCEPTOR` provider in `app.module.ts`, and no per-controller `@UseInterceptors`. Grepped the whole `apps/api/src` tree for any usage beyond its own file definition — none.

**Why it matters:** Right now the actual audit trail for "who accessed what" is limited to the hand-rolled `AuditLog` table (SEVIS ID views, document downloads/deletes) added in a prior session — that's good but narrow. This interceptor looks like infrastructure that should be catching everything and isn't, which is worse than not having written it at all: it creates a false sense that request-level auditing exists.

**Fix:** Either wire it up (`app.useGlobalInterceptors(new AuditInterceptor())` in `main.ts`, or as an `APP_INTERCEPTOR` provider) or delete it if the narrower `AuditLog` table is judged sufficient — don't leave working, well-written code silently inert.

**Before beta:** Should fix — cheap either way (one line to wire up, or delete + note the decision).

---

## Medium: `sameSite: 'none'` cookie is a necessary tradeoff, but has no CSRF backstop

**File:** `apps/api/src/modules/auth/auth.controller.ts:92-98`

**What's good:** the refresh cookie is `httpOnly`, `secure` in prod, and path-scoped to `/api/v1/auth` — genuinely thoughtful. `sameSite: 'none'` in production is a deliberate, understood tradeoff (frontend and API are on different domains/subdomains), not an oversight.

**What's missing:** with `SameSite=None`, the cookie *will* be sent on cross-site requests (that's the point), so `/auth/refresh` and `/auth/logout` can be triggered by a third-party page via a simple form/fetch with `credentials: 'include'`. CORS prevents the attacker's JS from *reading* the response, but the request still executes server-side — meaning a malicious page could force a logged-in visitor's refresh token to rotate or force a logout. Low real damage (no data disclosure, no state-changing action beyond session churn) but it's the kind of gap that compounds with future cookie-authenticated endpoints if any get added without the same care.

**Fix:** Not urgent given the limited blast radius today, but worth a double-submit CSRF token or `Origin`/`Sec-Fetch-Site` header check on the auth endpoints if you add any cookie-authenticated state-changing endpoint beyond refresh/logout later.

**Before beta:** Can wait — document the tradeoff, revisit if new cookie-auth surface is added.

---

## Medium: Swagger docs exposed in all environments

**File:** `apps/api/src/main.ts:35-38`

Repeating from the Beta Readiness Report since it's genuinely a security-surface item: `/api/docs` is public in every environment, listing full route/DTO shapes. Gate behind `!config.isProd`.

**Before beta:** Should fix, trivial.

---

## What's already solid (verified directly, not assumed)

- **Access token in memory only, refresh token in httpOnly cookie** (`apps/web/src/lib/api.ts`) — correct pattern, avoids XSS-based token theft via `localStorage`. Explicitly documented as ADR-003 in a code comment.
- **Refresh token rotation with reuse detection** — confirmed in `auth.service.ts::refresh()`: replaying a revoked token kills the entire token family, not just that token.
- **Field encryption** (`common/util/field-crypto.ts`) — AES-256-GCM with a random 12-byte IV per encryption and an auth tag, not a static IV or a weaker cipher mode. SEVIS ID, passport number, and date of birth are encrypted at the application layer, not just relying on disk/DB encryption.
- **Ownership-scoped Prisma queries** — spot-checked `documents.service.ts` and `career.service.ts`: every update/delete/read of a user-owned row is preceded by a `findFirst({ where: { id, userId } })` ownership check before acting, not a bare `findUnique({ where: { id } })`. This pattern is consistent, not ad hoc.
- **Presigned URLs are short-lived** — S3 upload URLs expire in 60s, download URLs in 120s, generated fresh per request server-side.
- **`NEXT_PUBLIC_*` vars are clean** — grepped every usage in `apps/web/src`; only the API base URL and the PostHog *public* key (designed to be public) are exposed. No secrets leaking into the client bundle.
- **File type/size validation is server-side**, not just client-side — enforced in `CreateDocumentDto` via `class-validator` (`@IsIn(ALLOWED_CONTENT_TYPES)`, `@Max(MAX_FILE_BYTES)`), which runs through the global `ValidationPipe` with `whitelist: true, forbidNonWhitelisted: true` — extra fields in a request body are rejected outright, not silently dropped or silently accepted.
- **Global exception filter never leaks internals** in production, and structured error logs carry a `requestId` for correlation without echoing sensitive request bodies.
- **Hard delete cascades correctly** — verified manually last session (zero orphaned `StudentProfile` rows after deletion) and confirmed again by reading the schema: every child model uses `onDelete: Cascade` back to `User`.

---

## Full findings, sorted by severity

| # | Severity | Area | Summary |
|---|----------|------|---------|
| 1 | Critical | Auth | Account takeover via unverified email + Google OAuth auto-linking |
| 2 | Critical | Storage | Unauthenticated path traversal in dev-storage; prod-exposure claim unenforced |
| 3 | High | Config | Single-origin CORS incompatible with apex+www |
| 4 | Medium | Observability | `AuditInterceptor` written but never registered |
| 5 | Medium | Auth | `SameSite=None` cookie has no CSRF backstop for refresh/logout |
| 6 | Medium | Config | Swagger docs public in all environments |

(Items already covered in the Beta Readiness Report — login rate limiting, no CI — are not repeated in full here; see that report for detail.)

---

## Top 10 fixes before any real user touches this

1. Stop Google OAuth from silently linking to existing password-based accounts *(Critical)*
2. Validate/sandbox `decodeStorageKey` against path traversal *(Critical)*
3. Enforce `STORAGE_DRIVER=s3` in production inside `validateEnv` *(Critical, pairs with #2)*
4. Fix CORS for apex + www *(High)*
5. Wire up or delete `AuditInterceptor` *(Medium)*
6. Gate Swagger out of production *(Medium)*
7. Add a CSRF check (Origin/Sec-Fetch-Site header) to `/auth/refresh` and `/auth/logout` *(Medium)*
8. Add the auth + document-ownership test suite from the Beta Readiness Report (this audit's two Critical items would both have been caught by tests written to probe exactly this) *(High, cross-referenced)*
9. Tighten login rate limiting per-email, not just per-IP *(Medium, cross-referenced)*
10. Decide and implement real email verification for password registration, not just as a Google-linking fix but as its own correctness item *(High)*

## Top 3 to implement first

1. **Google OAuth auto-linking (#1)** — highest severity, directly threatens document confidentiality, and is exploitable today with zero special access.
2. **dev-storage path traversal + unenforced prod gate (#2/#3)** — unauthenticated file read/write is about as bad as findings get; fix both the traversal and the env enforcement together since they're one root cause.
3. **CORS fix (#4)** — you just moved domains; this will actively break or subtly weaken security posture for a subset of real traffic if left alone.

## Security tests that must exist

- Register `victim@example.com`, then simulate Google login for the same email (stub `GoogleUser`) — assert it does **not** return the password-created account without an explicit ownership check.
- Request `GET /dev-storage/<base64 of "../../etc/passwd">` — assert 400/404, not file contents (run with `STORAGE_DRIVER=local` in a test env to actually exercise the code path).
- Boot the app with `NODE_ENV=production`, `STORAGE_DRIVER` unset — assert it throws at startup, doesn't silently start.
- Document ownership: user A creates a document; user B attempts `GET /documents/:id/download`, `DELETE /documents/:id` — both must 404 (not 403, to avoid confirming existence), matching the existing pattern already used elsewhere in the codebase (`immigration.service.ts` comments this exact rationale).
- Refresh token reuse: rotate a token, then replay the old (now-revoked) one — assert the entire family is revoked and a subsequent legitimate refresh with any token from that family fails.
- Hard delete: create a user with a profile, documents, deadlines, applications; delete the account; assert zero rows remain across every child table (not just `StudentProfile` — the manual check last session only covered one table).

## Manual test checklist

- [ ] Register with email A, attempt Google sign-in with the same email — confirm current (broken) behavior before and after the fix
- [ ] Try `/api/v1/dev-storage/<traversal-payload>` locally with `STORAGE_DRIVER=local`
- [ ] Confirm `/api/docs` is reachable in production today (it should be, given the current code) — decide if that's acceptable short-term
- [ ] From browser dev tools, confirm `waypoint_refresh` (or equivalent) cookie has `HttpOnly`, `Secure`, `SameSite=None` in production
- [ ] Load the app from both `https://waypointf1.com` and `https://www.waypointf1.com` (whichever isn't canonical) and confirm login actually works end-to-end, not just that the page loads
- [ ] Attempt to access another test user's document by ID while logged in as a different user

## Recommended `next.config.mjs` security headers

```js
async headers() {
  return [
    {
      source: '/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        {
          key: 'Content-Security-Policy',
          value: "default-src 'self'; connect-src 'self' https://waypoint-production-601d.up.railway.app https://us.i.posthog.com; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'",
        },
      ],
    },
  ];
}
```
(CSP is a starting point, not final — Next.js's own inline styles/scripts and PostHog's script loading may need adjustment; test in report-only mode first via `Content-Security-Policy-Report-Only` before enforcing.)

## Recommended rate limits for auth/document endpoints

Current state is already reasonable (`register`/`login` 10/min, `forgot-password` 5/min, `reset-password` 10/min, document `initiate` 20/min) — recommend tightening `login` to 5/min per IP and adding a secondary per-email counter so distributed IPs can't bypass the per-IP limit against one target account.

## Draft `SECURITY.md`

```markdown
# Security Policy

Waypoint handles sensitive immigration and identity documents for F-1 international
students, including I-20s, passports, and SEVIS-related data. We take that seriously.

## Reporting a vulnerability

Email security@waypointf1.com with details. Please do not open a public GitHub issue
for security reports. We aim to acknowledge reports within 48 hours.

## What we protect

- SEVIS ID, passport number, and date of birth are encrypted at the application layer
  (AES-256-GCM) before being stored, not just relying on database-level encryption.
- Documents are stored in a private object storage bucket; download links are
  short-lived, presigned URLs generated per request, never permanent public links.
- Refresh tokens are stored in httpOnly, secure cookies — never accessible to
  JavaScript, never stored in localStorage.
- All document and profile access is scoped to the authenticated user; no endpoint
  returns another user's data by design.

## Scope

This covers the Waypoint web app (waypointf1.com) and API. Third-party services we
rely on (Cloudflare R2/S3, Resend, Railway, Groq) have their own security programs.

## Disclosure

We ask for a reasonable window to fix confirmed issues before public disclosure.
```

---

No code was changed as part of this audit. Waiting for approval before implementing any of the above.
