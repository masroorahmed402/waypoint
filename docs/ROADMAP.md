# Roadmap

Every milestone ends with something a real student can use. Estimates assume 1 person part-time alongside school/work; halve them for full-time.

## M0 — Foundation (done: this scaffold)
Monorepo, docs, Prisma schema, auth module, storage abstraction, CI, docker-compose.

## M1 — Auth + Onboarding end-to-end (2 wks) — complexity: M
Deliverable: register/login/Google OAuth → onboarding form → profile saved. Deps: none.
Definition of done: e2e Playwright test covers signup → onboarding → dashboard shell.

## M2 — Immigration timeline + deadlines (3 wks) — complexity: H (the hard, valuable part)
Rules engine (F-1 v1: SSN eligibility, CPT eligibility, OPT window open/close, 60-day grace, travel signature, I-20/visa/passport expiry), timeline UI, deadline CRUD, recompute-on-profile-change. **Every rule unit-tested against USCIS-published examples.** Deps: M1.

## M3 — Document vault (2 wks) — complexity: M
Presigned upload flow, typed documents, expiry → deadline wiring, download, delete+purge job. Deps: M1; S3 bucket (or local driver).

## M4 — Application tracker (2 wks) — complexity: M
Kanban board, stage events, company typeahead, notes. Deps: M1.

## M5 — Email reminders + dashboard polish (1–2 wks) — complexity: M
Cron scanner, Resend/SES integration, NotificationLog idempotency, dashboard widgets (next deadlines, pipeline summary). Deps: M2.

## M6 — LAUNCH MVP (1 wk)
Deploy (single box or ECS), Sentry, seed DePaul + top-50 universities, privacy policy + ToS + immigration disclaimer review, onboard first 20 students by hand.

— total: ~10–12 weeks part-time —

## Phase 2 (post-validation, in priority order)
1. Sponsorship database — ingest public H-1B LCA disclosure data; this is the growth feature.
2. AI assistant — RAG over curated USCIS/SEVP corpus, pgvector, hard disclaimers.
3. University portal template (DePaul first).
4. OCR on documents → auto-extract expiry dates.
5. PostHog analytics, MFA.

## Phase 3 (only if Phase 2 metrics justify)
Community, marketplace, premium subscriptions (likely: sponsorship DB + AI behind $5–8/mo student tier), mobile (React Native reusing the API), non-US countries (rules engine versioning pays off here).

## Kill criteria (be honest)
If after 3 months post-launch <100 WAU and no organic referral loop, stop adding features and re-interview users — the wedge is wrong, not underbuilt.
