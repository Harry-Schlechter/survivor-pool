# 🏈 Survivor Pool

A self-hostable NFL survivor pool. Pick one team to win each week; pick wrong (or
tie, or forget) and you drop to the losers bracket — lose there and you're out.
Last player standing in each bracket splits the pot.

Built with **Next.js (App Router) + TypeScript**, **Neon Postgres** (via Drizzle
ORM), **Better Auth** (passwordless magic link), deployed on **Netlify**, email
via **Resend**, NFL data from **ESPN's free public API**.

## How the pool works

- Each NFL season opens with a signup window; pay the buy-in via Venmo (admin
  confirms).
- Every week, pick one team you think will **win**. Picks lock at the first game
  of the week (usually Thu ~8pm ET) and are revealed to everyone after lock.
- **Two-time rule:** during the regular season any team may be used at most
  twice. (Lifted in the playoffs — any team, any number of times.)
- **Win → survive. Loss / tie / no pick → loss.** A loss in the main *winners*
  pool drops you to the *losers bracket*; a loss there eliminates you.
- Entering the losers bracket resets your two-time usage (fresh slate).
- **Super Bowl tiebreaker:** alive players guess the total combined score; used
  only if 2+ are tied for the win.
- **Payouts:** 80% to the winners-pool champion, 20% to the losers-bracket
  champion. If the winners pool empties with no survivor, 100% goes to the
  losers champion.

## What's automatic vs. manual

The season runs itself once you've opened it. The admin's only recurring job is
confirming Venmo payments.

**Automatic (Netlify scheduled functions):**

- **Every 15 min** (`sync-scores`) — pull ESPN scores and grade finals as games
  complete, so standings update through game day.
- **Tuesday 3am ET** (`weekly-rollover`) — final-grade the week, **advance to the
  next week**, and **set the lock time to that week's first kickoff**. After
  regular-season week 18 it **auto-enters the playoffs** (following ESPN's real
  calendar) and lifts the two-time cap. If everyone's out, it marks the season
  complete.
- **Tuesday 9am ET** (`tue-summary`) — email everyone the recap of the week that
  just finished.
- **Thursday 9am ET** (`thu-reminder`) + **hourly** (`lock-reminder`) — nudge
  players who haven't picked; the lock reminder fires once when lock is <75 min
  away.

**Manual (admin, one-time or override):**

- **Create a season** (year, buy-in, Venmo link) and flip **signup → active**
  (which sets week-1's lock automatically).
- Confirm payments.
- Override buttons — Sync+grade now, Refresh lock, Advance week, Start playoffs,
  Complete, Archive — for when you need to intervene.

## Architecture

| Concern | Where |
|---|---|
| Pages / UI | `app/` (App Router; `(app)/` = authed, `login`/`rules` = public) |
| Pure game rules (tested) | `lib/picks.ts`, `lib/grading.ts`, `lib/payouts.ts`, `lib/stats.ts` |
| ESPN integration | `lib/espn.ts` (single file to patch if ESPN changes) |
| DB schema (source of truth) | `lib/db/schema.ts` (Drizzle) → `drizzle/*.sql` |
| DB client | `lib/db/index.ts` (Drizzle over Neon) |
| Data access | `lib/queries/*` |
| Season orchestration | `lib/season-ops.ts` (sync, grade, rollover, playoffs flip) |
| Auth | `lib/auth/` (Better Auth: server, client, guards) + `app/api/auth/[...all]` |
| Scheduled jobs | `netlify/functions/` (cron in `netlify.toml`) |

**No row-level security:** Neon doesn't enforce RLS, so all data access is
server-side and authorization lives in `lib/auth/guards.ts` + per-mutation checks
in the API routes / server actions (e.g. the pick rules in `lib/picks.ts`, and
the post-lock pick-visibility rule in `lib/queries/standings.ts`).

## Local setup

1. `npm install`
2. Create a free project at [neon.tech](https://neon.tech) and copy the **pooled**
   connection string.
3. `cp .env.local.example .env.local` and fill in (see below).
4. Apply the schema to Neon:
   ```bash
   npm run db:push        # pushes lib/db/schema.ts straight to the DB
   # or: npm run db:generate && npm run db:migrate  (versioned migrations)
   ```
5. `npm run dev` → http://localhost:3000
6. Seed a finished week to exercise grading without waiting for live games:
   ```bash
   node scripts/seed.mjs --year 2024 --week 1
   # or a full demo dataset (26 users, 3 past seasons, current season at wk5):
   node scripts/flood-seed.mjs
   ```
7. Sign in once (magic link), then make yourself admin:
   ```bash
   npm run make-admin you@example.com
   ```

### Environment variables

| Var | Notes |
|---|---|
| `DATABASE_URL` | Neon pooled connection string (Netlify DB sets `NETLIFY_DATABASE_URL`, read as fallback) |
| `BETTER_AUTH_SECRET` | **secret** — `openssl rand -base64 32` |
| `NEXT_PUBLIC_SITE_URL` | e.g. `https://survivor.yourdomain.com` (magic-link callbacks) |
| `RESEND_API_KEY` | **secret** |
| `EMAIL_FROM` | e.g. `Survivor Pool <pool@yourdomain.com>` (use `onboarding@resend.dev` until your domain is verified) |
| `CRON_SECRET` | guards any HTTP-triggerable job route |

## Deploy (Netlify)

1. Connect this repo in Netlify (auto-detects Next.js via `@netlify/plugin-nextjs`).
2. Set all env vars above in **Site settings → Environment variables**.
3. Scheduled functions register automatically from `netlify.toml`.
4. Run `npm run db:push` once against the production `DATABASE_URL` to create the
   tables.

> **Staying free:** Neon's free tier gives 100 projects (no per-project charge),
> so this — and every other site — can live there for free.

## Testing

```bash
npm test          # vitest: espn, picks, grading, payouts, stats (+ wk1 integration)
npm run typecheck
npm run build
```

The grading engine is tested against the real 2024 week-1 ESPN fixture
(`__fixtures__/espn-2024-wk1.json`), including tie-as-loss and missed-pick-as-loss.
