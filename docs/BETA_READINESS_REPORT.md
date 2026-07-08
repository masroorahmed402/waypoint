# Waypoint — Public Beta Readiness Report

Read-only audit. No code was changed to produce this report. Findings are grounded in direct inspection of the current repo state (not assumptions from memory).

Severity legend: **Critical** = must fix before any real user touches it · **High** = must fix before public beta · **Medium** = should fix before beta, acceptable to slip one cycle · **Low** = polish, can wait.

---

## 1. Critical: secret committed to git history

**Area:** Repo hygiene / secrets management
**Files:** `cookies.txt` (repo root), `.gitignore`
**What's wrong:** A real refresh-token cookie file (`iso_refresh=...`) is tracked in git, committed in the very first commit (`66f155b`, 2026-07-06) and pushed to the remote. It's a local-dev token (bound to `localhost`, a dev Postgres instance), so exploitability today is low — but it establishes a bad precedent, and `.gitignore` doesn't exclude cookie jars or other loose credential files, so the next `curl -c cookies.txt` during dev testing will land in a diff again.
**Why it matters:** Any secret in git history is a secret forever, regardless of later deletion, unless history is rewritten. This is the single most concrete "we don't have secret hygiene" signal in the repo.
**Fix:** Delete `cookies.txt` from the working tree, add `cookies.txt` and `*.cookies` to `.gitignore`. Full removal from git history (`git filter-repo` or BFG + force-push) is a separate, disruptive action — flag it, don't do it silently.
**Acceptance criteria:** `git ls-files | grep -i cookie` returns nothing; `.gitignore` covers cookie jars; team is aware history still contains the old token (harmless since it's a localhost dev token, but should be a conscious decision, not an oversight).
**Before beta:** Yes — trivial to fix, and it's exactly the kind of thing a beta user's screenshot of your GitHub could surface.

---

## 2. High: single-origin CORS will break `www.waypointf1.com`

**Area:** Backend config / domain migration
**Files:** `apps/api/src/main.ts:20`, `apps/api/src/config/app.config.ts` (`webOrigin` getter)
**What's wrong:** `app.enableCors({ origin: config.webOrigin, credentials: true })` — `webOrigin` is a single string read from `WEB_ORIGIN`. If Railway's `WEB_ORIGIN` is set to `https://waypointf1.com`, any request from `https://www.waypointf1.com` (or vice versa) will be blocked by CORS. Given you just moved domains via Cloudflare + Vercel, this is exactly the kind of thing that silently breaks "it works for me" and fails for a subset of users depending on which host they land on.
**Why it matters:** A CORS mismatch presents as "nothing works, no clear error" — the worst kind of bug for a beta user to hit.
**Fix:** Either (a) redirect `www` → apex (or vice versa) at the Vercel/Cloudflare level so only one origin ever reaches the API, or (b) change `webOrigin` to accept a comma-separated list and pass an array/function to `enableCors`. (a) is simpler and more standard.
**Acceptance criteria:** Requests from both `https://waypointf1.com` and `https://www.waypointf1.com` (whichever isn't the canonical one) either redirect cleanly or are both allowlisted — verified with a real browser network tab, not just curl (curl doesn't enforce CORS).
**Before beta:** Yes.

---

## 3. High: zero test coverage outside the rules engine

**Area:** Testing
**Files:** whole repo — only `apps/api/src/modules/immigration/f1.rules.spec.ts` (API) and `apps/web/e2e/signup-onboarding.spec.ts` (27 lines, web) exist
**What's wrong:** Auth (register/login/refresh-rotation/reuse-detection), document ownership/authorization, hard-delete cascade behavior, and every other service have no automated tests. The rules engine — genuinely the most tested part — is good, but it's an island.
**Why it matters:** Your own standard says "immigration rule changes must include tests" and "add or update tests when business logic changes." Right now there's no safety net for the two areas that would hurt most if broken silently: auth and document ownership. This is also why bugs like the account-deletion issue from the last session weren't caught before you found them manually.
**Fix (don't do yet, just scope):** Add API-level tests for: register→login round trip, refresh token reuse detection (revokes the whole family), document ownership (user A cannot download/delete user B's document), hard-delete cascade (no orphaned rows — I verified this manually last session, it should be a permanent test, not a one-off curl script).
**Acceptance criteria:** A `pnpm test` run in CI would have caught the account-deletion bug and would catch a regression if someone reintroduces a `deletedAt` check.
**Before beta:** High priority but not literally blocking — the risk is regressions, not a known current bug (all three prior bugs are fixed and manually verified).

---

## 4. Medium: Swagger docs exposed in all environments

**Area:** Backend / API surface exposure
**File:** `apps/api/src/main.ts:35-38`
**What's wrong:** `SwaggerModule.setup('api/docs', app, ...)` runs unconditionally, so `https://<api-domain>/api/docs` is public in production, listing every route, DTO shape, and auth scheme.
**Why it matters:** Not a breach by itself (routes already require auth), but it's free reconnaissance for anyone probing the API, and it's inconsistent with "we take student data seriously."
**Fix:** Gate behind `!config.isProd`, or behind a basic-auth/internal-only check if you want it reachable in prod for your own debugging.
**Acceptance criteria:** `/api/docs` 404s (or requires auth) in production; still works in dev.
**Before beta:** Should fix, low effort.

---

## 5. Medium: landing page mixes "live product" and "waitlist" signals

**Area:** Frontend UX / marketing consistency
**File:** `apps/web/src/app/page.tsx`
**What's wrong:** The header CTA (`Get started` → `/register`) points at a fully working registration flow, but the page's bottom section is a waitlist email-capture (`joinWaitlist`, `state: 'idle'|'busy'|'done'`). A visitor who scrolls to the bottom gets a different, weaker impression ("join the list, we'll be in touch") than one who clicks the top button (immediate signup). Also, "Get started" / "Get started free" are exactly the vague CTAs your own standard calls out to avoid, in favor of something concrete like "Generate my F-1 timeline."
**Why it matters:** Mixed signals read as unfinished/uncertain, which undercuts trust for a product asking people to upload an I-20.
**Fix:** Decide: is this open registration or a waitlist? If registration is live (it is), remove or repurpose the waitlist section — e.g. make it the same `/register` CTA, or drop it. Replace generic CTA copy with something concrete per your own rules.
**Acceptance criteria:** One consistent call-to-action story top-to-bottom on the landing page.
**Before beta:** Should fix — this is a first-impression issue, and first impressions are what beta invites ride on.

---

## 6. Medium: no error-tracking/observability service

**Area:** Observability
**Files:** n/a (absence) — `apps/api/src/common/filters/global-exception.filter.ts` logs structured JSON via `console.error` only; no Sentry/equivalent found in either app's dependencies
**What's wrong:** 5xx errors are logged to stdout with a `requestId`, which is good discipline, but nothing aggregates, alerts, or lets you search across them. On Railway/Vercel that means "grep the log stream and hope," which doesn't scale past a handful of beta users.
**Why it matters:** Once real users are on it, you need to know about production errors before they tell you, especially for a product handling documents like I-20s and passports.
**Fix:** Add Sentry (or similar) to both apps — low-effort, well-trodden path, respects "explain why for new deps": it's the standard fix for "we can't see production errors."
**Acceptance criteria:** A forced 500 in prod shows up in the error-tracking dashboard with the same `requestId` as the log line, so the two can be correlated.
**Before beta:** Nice to have day one; acceptable to add in week one of beta if truly time-constrained.

---

## 7. Medium: login rate limit is generous for brute force

**Area:** Security — auth
**File:** `apps/api/src/modules/auth/auth.controller.ts:29`
**What's wrong:** `/auth/login` allows 10 attempts/minute per IP. Combined with the uniform-failure-path timing protection (good — verified in `auth.service.ts`), this isn't catastrophic, but 10/min per IP is still ~14,400 guesses/day from a single IP, and doesn't account for distributed attempts across many IPs against one account.
**Why it matters:** Password strength is enforced at registration (zxcvbn score ≥ 3), which helps, but rate limiting is still the first line of defense against credential stuffing.
**Fix:** Consider lowering to 5/min per IP and adding a secondary limit keyed by email (not just IP) for login specifically, so distributed attempts against one account are also throttled.
**Acceptance criteria:** Documented rate limit decision; a scripted 20-attempt login burst against one account gets throttled regardless of source IP diversity.
**Before beta:** Can wait — not a known active risk, just tightenable.

---

## 8. Low: generic landing-page CTAs

**Area:** Copy
**File:** `apps/web/src/app/page.tsx`
**What's wrong:** "Get started" / "Get started free" appear three times. Your own standard explicitly lists these as CTAs to avoid in favor of concrete ones.
**Fix:** e.g. "Upload your I-20" or "Build my F-1 timeline."
**Before beta:** Nice-to-have, bundle with item 5.

---

## 9. Low: STEM-eligibility copy slightly overconfident

**Area:** Immigration-rules copy
**File:** `apps/web/src/app/page.tsx:15` ("We automatically detect if your degree qualifies for 24-month STEM OPT extension")
**What's wrong:** The detection is real (CIP-code-prefix matching against DHS's published STEM list, verified in `pdf-i20.extractor.ts`), but "qualifies" reads as a determination rather than a signal. Elsewhere in the app (dashboard, onboarding) the same detection is correctly hedged ("may be eligible"). The landing page is the one place still using the stronger verb.
**Fix:** Align wording with the rest of the app: "may qualify" / "detect eligibility signals for."
**Before beta:** Cosmetic, bundle with item 5.

---

## What's already solid (worth naming, so it doesn't get "refactored" away)

- **Global exception filter** — consistent error envelope, no internal leakage in prod, structured server-side logging with request IDs. This is the kind of thing your standard asks for and it's already there.
- **Document ownership model** — every document read/write goes through a `findOwned(userId, id)` pattern that scopes to the authenticated user; presigned upload/download URLs are short-lived (60s/120s) and generated server-side per request, not reused.
- **Sensitive field encryption** — SEVIS ID, passport number, date of birth are AES-256-GCM encrypted at the application layer (not just relying on disk encryption), and the AI advisor is explicitly instructed never to echo them back.
- **Refresh token rotation with reuse detection** — token families, and replaying a revoked token kills the whole family, not just that token. This is a real, non-trivial security pattern, correctly implemented.
- **Env validation fails fast** — the app refuses to boot in production with a placeholder JWT secret or missing required vars, rather than silently running insecurely.
- **Rules engine has real tests and versioning** — `RULE_VERSION` is threaded through generated deadlines, and `f1.rules.spec.ts` checks real invariants (OPT window math, chronological consistency, every milestone has an explanation). This is the one part of the codebase that already meets the bar you're asking for everywhere else.

---

## Top 10 fixes before public beta

1. Remove `cookies.txt` from the tree and `.gitignore` it *(Critical, trivial)*
2. Fix CORS to handle both `waypointf1.com` and `www.waypointf1.com` *(High)*
3. Add API tests for auth flow, document ownership, and hard-delete cascade *(High)*
4. Gate Swagger docs out of production *(Medium)*
5. Resolve the landing-page waitlist-vs-live-signup inconsistency *(Medium)*
6. Add Sentry (or equivalent) to both apps *(Medium)*
7. Tighten login rate limiting (per-email, not just per-IP) *(Medium)*
8. Replace generic CTAs with concrete ones *(Low)*
9. Align STEM-eligibility landing copy with the hedged wording used elsewhere *(Low)*
10. Do a manual pass confirming the "informational only / confirm with your DSO" disclaimer appears on every immigration-bearing surface, not just the ones built in the most recent session (I added it to dashboard/immigration/advisor/onboarding this session — worth a final sweep)

## Top 3 to do first

1. **`cookies.txt`** — five minutes, zero risk, real hygiene signal.
2. **CORS fix** — directly tied to the domain move you just made; will actively break for some users if left alone.
3. **Auth + document-ownership tests** — highest leverage: this is the area where "silent breakage" would hurt a real beta user the most (their documents, their session).

## Can wait

Items 6-9 above, plus any deeper mobile-responsiveness or component-consistency pass — I did not do a full page-by-page mobile/visual audit in this pass (would need either a running instance + browser, or a much longer session); flagging that as unverified rather than claiming it's fine.

## Suggested 2-week polish plan

- **Days 1-2:** Top 3 fixes above.
- **Days 3-5:** Sweep every immigration-bearing page for disclaimer consistency; fix landing page copy/CTA inconsistency; gate Swagger.
- **Days 6-9:** Add Sentry; write the auth + document-ownership + hard-delete test suite (this is the biggest single chunk of work in the plan).
- **Days 10-12:** Full manual mobile pass on the 5 highest-traffic pages (dashboard, documents, immigration, advisor, settings) — actually load them on a phone-width viewport and note what breaks.
- **Days 13-14:** Buffer + re-run this report to confirm closure.

## On `AI_ENGINEERING_RULES.md`

Your full standard is now saved as `/CLAUDE.md` at the repo root, which is the file that actually gets auto-loaded into every future session — that supersedes a separate `AI_ENGINEERING_RULES.md`. No need to maintain two copies of the same rules; if you want a short human-facing README pointer to it, that's a one-line addition to `README.md`, not a new rules file.
