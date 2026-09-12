// Called by GitHub Actions a few minutes after the week's lock passes (see
// .github/workflows/cron.yml — same narrow Wed/Thu-evening trigger as
// lock-reminder, since lock always falls on one of those two evenings).
// Emails everyone the revealed picks for the week, grouped by bracket —
// "picks are in" companion to tue-summary's end-of-week recap.
//
// Fires once per week: only when lock passed in roughly the last 30 minutes,
// deduped via the notifications table so a repeat call in that window (or a
// GitHub Actions retry) can't resend.

import { type NextRequest, NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/cron/auth";
import { getActiveSeason, getActiveEntries, heartbeat } from "@/lib/cron/shared";
import { db } from "@/lib/db";
import { picks, notifications } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { sendEachEmail } from "@/lib/email/send";
import { picksLockedEmail } from "@/lib/email/templates";

// Wide enough to absorb GitHub Actions scheduling delay (documented behavior,
// sometimes several minutes under load) landing on either of the two GitHub
// Actions ticks that check this route (see cron.yml) without missing the
// week entirely; the once-per-week dedup below is what actually prevents a
// resend, not this window being narrow.
const WINDOW_MS = 60 * 60 * 1000;

export async function POST(request: NextRequest) {
  const unauthorized = requireCronSecret(request);
  if (unauthorized) return unauthorized;

  const season = await getActiveSeason();
  if (!season || !season.lockAt) {
    return NextResponse.json({ ok: true, note: "no lock" });
  }

  const msSinceLock = Date.now() - new Date(season.lockAt).getTime();
  if (msSinceLock < 0 || msSinceLock > WINDOW_MS) {
    return NextResponse.json({ ok: true, note: "not in post-lock window" });
  }

  // Once-per-week dedup. Keyed on the season, not per-entry, since this is a
  // single broadcast — entryId is left null on this row. NOTE: the table's
  // unique index includes entryId, and Postgres never treats NULL = NULL for
  // uniqueness, so that index does NOT itself prevent a second null-entryId
  // row here. This existence check is the actual guard.
  const already = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(
        eq(notifications.seasonId, season.id),
        eq(notifications.week, season.currentWeek),
        eq(notifications.kind, "post_lock_summary"),
      ),
    )
    .limit(1);
  if (already.length > 0) {
    return NextResponse.json({ ok: true, note: "already sent this week" });
  }

  const active = await getActiveEntries(season.id);
  const pickRows = await db
    .select({ entryId: picks.entryId, teamAbbr: picks.teamAbbr })
    .from(picks)
    .where(and(eq(picks.seasonId, season.id), eq(picks.week, season.currentWeek)));
  const pickByEntry = new Map(pickRows.map((p) => [p.entryId, p.teamAbbr]));

  const main = active
    .filter((e) => e.bracket === "main")
    .map((e) => ({ name: e.name, pick: pickByEntry.get(e.entryId) ?? null }));
  const losers = active
    .filter((e) => e.bracket === "losers")
    .map((e) => ({ name: e.name, pick: pickByEntry.get(e.entryId) ?? null }));

  const { subject, html } = picksLockedEmail({
    week: season.currentWeek,
    main,
    losers,
  });

  const recipients = active.map((e) => e.email).filter(Boolean);
  const { sent, failed } = await sendEachEmail(recipients, subject, html);

  // Record the broadcast as sent (one row is enough for the dedup check above)
  // only after a real attempt, mirroring the per-entry pattern elsewhere.
  await db.insert(notifications).values({
    seasonId: season.id,
    week: season.currentWeek,
    kind: "post_lock_summary",
    entryId: null,
  });

  await heartbeat(
    "post-lock-summary",
    `Week ${season.currentWeek}. Sent ${sent}, failed ${failed.length}. ${main.length + losers.length} entries.`,
  );

  return NextResponse.json({ ok: true, sent, failed: failed.length });
}
