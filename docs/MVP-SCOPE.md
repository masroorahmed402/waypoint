# MVP Scope

**Status:** Accepted (CTO decision — overrule me by editing this file and DECISIONS.md)
**Date:** 2026-07-06

## The one-sentence MVP

A web app where an international student signs up, sees their personal visa/status timeline with automated deadline reminders, stores their immigration documents securely, and tracks their job/internship applications.

## Why this scope

The proposal lists 10 modules. Building all of them before launch guarantees launching nothing. The MVP is chosen by one filter: **what does an F-1 student check weekly and panic about if they miss?**

1. **Immigration deadlines** — missing an OPT filing window or travel signature has catastrophic, irreversible consequences. Nothing else in the product has stakes this high. This is the wedge.
2. **Document vault** — students already email themselves I-20 scans. Low build cost, high daily utility, and it makes the deadline tracker smarter (expiry dates come from documents).
3. **Application tracker** — every international student is job hunting under a time constraint (CPT/OPT windows). This gives the product a *daily* use case, not just a quarterly one.

## Explicitly OUT of MVP (and why)

| Feature | Why deferred |
|---|---|
| Marketplace | Needs liquidity (two-sided). Zero users = dead marketplace = looks abandoned. Phase 3. |
| Community | Same cold-start problem. Reddit/WhatsApp groups already exist; we can't beat them at zero users. Phase 3. |
| AI Assistant | High legal risk (immigration advice), high cost, and RAG over trusted sources needs a curated corpus we don't have yet. Phase 2, informational-only, heavily disclaimed. |
| Finance / budgeting | Crowded market (Mint successors, bank apps). Not a differentiator. Phase 3, maybe never. |
| Resume builder / ATS scorer | Crowded (Rezi, Teal, etc.). The *tracker* is the wedge; builder tools come later if users ask. |
| Sponsorship database | Genuinely differentiating but needs data acquisition strategy (H-1B LCA public data ingestion). Phase 2 — designed in the schema now, built later. |
| University portals | Requires per-university content ops. Phase 2, starting with ONE university (DePaul) as the template. |
| Roommate matching, housing | Phase 3. |

## MVP feature list (buildable in 8–10 weeks by 1–2 people)

- Email/password + Google OAuth signup, JWT + refresh tokens
- Onboarding: university, program, degree level, key dates (program start/end, visa dates)
- **Immigration timeline**: auto-generated milestone timeline (arrival → SSN → CPT → OPT window → grace period) computed from the user's dates
- **Deadline tracker**: system-generated deadlines (I-20 expiry, visa expiry, OPT filing window opens/closes, travel signature) + custom deadlines; email reminders at 90/30/7/1 days
- **Document vault**: upload to S3 (presigned URLs), typed documents (passport, visa, I-20, I-94, EAD…), expiry dates feed the deadline tracker. OCR deferred.
- **Application tracker**: kanban-style pipeline (saved → applied → interview → offer/rejected), per-application notes, sponsorship flag
- Dashboard: next 3 deadlines, application pipeline summary, timeline position

## Non-goals for MVP

No mobile app. No payments. No admin panel beyond seed scripts. No multilingual. No SMS. English + US (F-1) only — the data model supports other countries/visa types, the product doesn't yet.

## Success criteria before building Phase 2

- 50 weekly-active students (start with DePaul international student orgs)
- ≥30% of signups upload ≥1 document
- ≥5 unprompted "this saved me from missing X" reports
