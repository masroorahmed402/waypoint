# Deploying Waypoint

Goal: a public link (like `https://waypoint-app.vercel.app`) that any student can open and use.

## The stack (and why)

| Piece | Where | Why | Cost |
|---|---|---|---|
| Web app (Next.js) | **Vercel** | Built for Next.js, gives you the public link, free | $0 |
| API (NestJS) + cron | **Railway** | Long-running service so the daily reminder cron stays alive | ~$5/mo |
| Postgres | **Railway** | Managed, one click, same project as the API | included |
| Redis | **Railway** | Rate limiting | included |
| File storage (I-20s) | **Cloudflare R2** | S3-compatible, generous free tier, no egress fees | $0 to start |
| Email reminders | **Resend** | Already integrated; free tier ~3k emails/mo | $0 |
| Analytics | **PostHog** | Already integrated; free tier 1M events/mo | $0 |

Total to launch: about **$5/month** (just Railway). Everything else has a free tier that covers your first hundreds of users.

Time to do this the first time: **60–90 minutes.** Take it in order; each step depends on the one before.

---

## Step 0 — Put the code on GitHub

Railway and Vercel deploy *from* GitHub.

```bash
cd ~/Downloads/iso
git init
git add .
git commit -m "Waypoint"
```

Then on github.com: **New repository** → name it `waypoint` → **Private** → Create. Copy the two commands GitHub shows under "push an existing repository" and run them. Your code is now on GitHub.

(`.env` is gitignored, so your secrets do NOT get pushed. Good.)

---

## Step 1 — Storage: Cloudflare R2

1. Sign up at **dash.cloudflare.com** (free).
2. Left sidebar → **R2** → **Create bucket** → name it `waypoint-documents` → Create.
3. R2 → **Manage R2 API Tokens** → **Create API Token** → permissions **Object Read & Write** → Create. Copy the **Access Key ID**, **Secret Access Key**, and the **endpoint URL** (looks like `https://<accountid>.r2.cloudflarestorage.com`). Save these somewhere for Step 3.
4. Bucket → **Settings** → **CORS Policy** → add this (replace the origin once you have your Vercel URL in Step 6, for now use `*` and tighten later):

```json
[
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "PUT"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

This CORS step is required — the browser uploads I-20s directly to R2, and without it the upload is blocked.

---

## Step 2 — Email: Resend

1. Sign up at **resend.com** (free).
2. **API Keys** → **Create API Key** → copy it (save for Step 3).
3. For testing you can send from Resend's shared `onboarding@resend.dev` with no domain setup. To send to real students, go to **Domains** → **Add Domain**, add the DNS records they give you at your domain registrar, and once verified set `EMAIL_FROM` to something like `Waypoint <hello@yourdomain.com>`. Domain verification can wait until after your first test.

---

## Step 3 — API + database on Railway

1. Sign up at **railway.app** with GitHub.
2. **New Project** → **Deploy from GitHub repo** → pick your `waypoint` repo.
3. Railway starts building the whole repo. We need to point it at the API folder:
   - Open the service → **Settings** → **Root Directory**: `apps/api`
   - **Build Command**: `pnpm install && pnpm prisma:generate && pnpm build`
   - **Start Command**: `pnpm prisma migrate deploy && node dist/main.js`
   - (This runs DB migrations automatically on every deploy — safe and idempotent.)
4. Add the databases: in the project, **New** → **Database** → **PostgreSQL**. Again **New** → **Database** → **Redis**.
5. Open the API service → **Variables** → add these (Railway auto-provides `DATABASE_URL` and `REDIS_URL` if you reference the plugins — use the "Add Reference" button for those two):

```
NODE_ENV=production
API_PORT=4000
WEB_ORIGIN=https://REPLACE_WITH_VERCEL_URL   # fill after Step 6, then redeploy
DATABASE_URL=<reference the Postgres plugin>
REDIS_URL=<reference the Redis plugin>
JWT_ACCESS_SECRET=<run: openssl rand -base64 48>
FIELD_ENCRYPTION_KEY=<run: openssl rand -hex 32>
STORAGE_DRIVER=s3
S3_BUCKET=waypoint-documents
S3_REGION=auto
S3_ENDPOINT=<your R2 endpoint from Step 1>
AWS_ACCESS_KEY_ID=<R2 Access Key ID>
AWS_SECRET_ACCESS_KEY=<R2 Secret Access Key>
EMAIL_FROM=Waypoint <onboarding@resend.dev>
RESEND_API_KEY=<from Step 2>
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=
```

Generate the two secrets **fresh** (don't reuse your local dev ones):
```bash
openssl rand -base64 48   # JWT_ACCESS_SECRET
openssl rand -hex 32      # FIELD_ENCRYPTION_KEY
```

6. Railway redeploys. When it's green, open the service → **Settings** → **Networking** → **Generate Domain**. You get something like `waypoint-api-production.up.railway.app`. **This is your API domain — save it.**
7. Seed the universities once: service → **⋮** menu → open a shell (or use Railway CLI `railway run`) → run `pnpm prisma:seed`.

Test it: open `https://<your-api-domain>/api/health` in a browser — you should see `{"status":"ok"}`.

---

## Step 4 — Analytics: PostHog

1. Sign up at **posthog.com** (free, pick US or EU cloud).
2. **Project Settings** → copy your **Project API Key** (starts with `phc_`).
3. Note the host: `https://us.i.posthog.com` (US) or `https://eu.i.posthog.com` (EU). You'll paste both into Vercel in Step 5.

That's it — the code already sends `signup`, `i20_uploaded`, `onboarding_complete`, and `waitlist_joined` events, plus pageviews. Autocapture and session recording are turned OFF on purpose (this app handles immigration data).

---

## Step 5 — Web app on Vercel

1. Sign up at **vercel.com** with GitHub.
2. **Add New** → **Project** → import your `waypoint` repo.
3. **Root Directory**: click Edit → set to `apps/web`.
4. Framework preset: Vercel auto-detects **Next.js**. Leave build settings default.
5. **Environment Variables** — add:

```
NEXT_PUBLIC_API_URL = https://<your-railway-api-domain>/api/v1
NEXT_PUBLIC_POSTHOG_KEY = phc_...        (from Step 4)
NEXT_PUBLIC_POSTHOG_HOST = https://us.i.posthog.com
```

6. **Deploy.** In ~2 minutes you get your public URL, e.g. `https://waypoint.vercel.app`. **This is the link you share.**

---

## Step 6 — Connect the two (important)

The API needs to know the web app's URL, or logins fail with CORS/cookie errors.

1. Go back to **Railway → API service → Variables** and set:
   `WEB_ORIGIN = https://waypoint.vercel.app` (your exact Vercel URL, no trailing slash).
2. Railway redeploys.
3. Tighten the **R2 CORS** (Step 1) — replace `"*"` in `AllowedOrigins` with `["https://waypoint.vercel.app"]`.

Why this matters: the login session uses a secure cross-site cookie between your Vercel and Railway domains. The API only accepts requests from the exact `WEB_ORIGIN` you set. If they don't match, the browser silently blocks the session.

---

## Step 7 — Smoke test (do this before sharing the link)

Open your Vercel link and walk the whole flow:

1. Landing page loads, join the waitlist → check the `waitlist_joined` event shows up in PostHog (Activity tab).
2. **Register** a new account → lands on onboarding.
3. **Upload an I-20** → fields pre-fill → check `i20_uploaded` in PostHog.
4. Finish onboarding → dashboard shows your timeline and deadlines.
5. Go to the API docs `https://<api-domain>/api/docs`, log in flow aside, trigger reminders manually: you can't hit the dev-only `/notifications/run` in prod (it's disabled), so instead create a custom deadline dated ~7 days out and wait for the 8am cron — or temporarily set a deadline and confirm the email arrives once the cron runs.
6. Upload → **Documents persist** across a redeploy (they're in R2, not the container). Confirm by redeploying and re-downloading.

If login fails: 99% of the time it's `WEB_ORIGIN` not matching your Vercel URL exactly. Check Step 6.

---

## Step 8 — Custom domain (optional, do it before real launch)

A real domain (`waypoint.app`) looks trustworthy and lets you use `app.waypoint.app` + `api.waypoint.app`, which also lets you switch the session cookie back to the stricter `SameSite=Lax`.

1. Buy a domain (Namecheap, Cloudflare Registrar).
2. Vercel → project → **Domains** → add `app.waypoint.app`, follow DNS instructions.
3. Railway → API → **Networking** → **Custom Domain** → add `api.waypoint.app`.
4. Update `NEXT_PUBLIC_API_URL` (Vercel) and `WEB_ORIGIN` (Railway) to the new domains, redeploy both.

---

## What "keeping it alive" means

- **Railway runs your API continuously**, so the daily 8am reminder cron fires. Don't use a host that sleeps on idle (like Render's free tier) — a sleeping API means no reminders, which kills the whole point.
- **Migrations run automatically** on each Railway deploy (`prisma migrate deploy` in the start command). When you add a feature with a schema change, just push to GitHub and Railway applies it.
- **Vercel redeploys automatically** on every push to your GitHub main branch.

## Launch checklist

- [ ] Smoke test passes end-to-end
- [ ] Resend domain verified (so emails don't go to spam)
- [ ] R2 CORS locked to your real origin
- [ ] Privacy + Terms reviewed by a lawyer (you're holding I-20s)
- [ ] First 10 DePaul students lined up to onboard by hand
- [ ] PostHog dashboard open so you can watch where they drop off
