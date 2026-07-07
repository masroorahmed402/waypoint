# Security Design

Threat model in one line: we hold immigration documents and identity data for a vulnerable population. A breach here is not "reset your password" — it's passports and SEVIS records. Act accordingly.

## Controls (Phase 1, implemented in scaffold)

**Authentication** — see ADR-003. Argon2id password hashing (memory 64MB, iterations 3), zxcvbn strength check on register, uniform login errors (no user enumeration), refresh rotation + family reuse detection.

**Authorization** — global JwtAuthGuard (opt-out via @Public), RolesGuard for admin routes, ownership enforced in every service query (`where: { id, userId }`), 404 on foreign resources.

**Input** — global ValidationPipe (whitelist, forbidNonWhitelisted, transform). Prisma parameterizes everything (no raw SQL; if ever needed, `$queryRaw` tagged templates only). File uploads: content-type + extension allowlist, 20MB cap, per-user quota, size verified server-side on confirm.

**Web** — helmet (CSP, HSTS, nosniff, frame-deny), strict CORS (exact origin from env, credentials true), SameSite=Lax cookies, no tokens in localStorage ever, React escaping + no dangerouslySetInnerHTML policy.

**Rate limiting** — @nestjs/throttler on Redis: 100/min global per user, 10/min auth per IP, 20/min presign per user.

**Secrets & crypto** — env validated at boot (app refuses to start incomplete), .env never committed, SEVIS/passport numbers AES-256-GCM app-layer encrypted, S3 SSE enabled, TLS everywhere.

**Audit** — interceptor logs {requestId, userId, method, route, status, latency} as structured JSON; auth events (login, refresh reuse, logout) logged distinctly. No document contents, no tokens, no PII values in logs.

**Dependencies** — pnpm audit + Dependabot in CI; lockfile committed.

## Phase 2 additions
MFA (TOTP), session/device management UI, KMS-managed keys, penetration test before premium launch, SOC2-lite policy docs when universities ask.

## Incident posture
Backups: RDS PITR + daily snapshot, tested restore quarterly. Breach plan: revoke all refresh families (one UPDATE), rotate JWT secret, force re-auth, notify per state law.
