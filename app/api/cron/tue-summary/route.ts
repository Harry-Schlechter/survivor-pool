// Called Tuesday morning by GitHub Actions (see .github/workflows/cron.yml).
// Emails everyone the recap of the week that just finished. Runs AFTER the
// weekly-rollover call, which already graded that week and advanced
// current_week — so the completed week is current_week - 1.
//
// Replaces the Netlify Scheduled Function of the same name: that trigger
// silently stopped firing site-wide (see lib/cron/shared.ts for the story).

import { type NextRequest, NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/cron/auth";
import { getActiveSeason, getActiveEntries, heartbeat } from "@/lib/cron/shared";
import { db } from "@/lib/db";
import { entries, picks, user, notifications } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { sendEachEmail } from "@/lib/email/send";
import { weekSummaryEmail } from "@/lib/email/templates";

export async function POST(request: NextRequest) {
  const unauthorized = requireCronSecret(request);
  if (unauthorized) return unauthorized;

  const season = await getActiveSeason();
  if (!season) {
    return NextResponse.json({ ok: true, note: "no active season" });
  }

  // The rollover already advanced the week, so the just-completed week is the
  // one before current_week (floor at 1 for safety).
  const summaryWeek = Math.max(1, season.currentWeek - 1);

  // Once-per-week dedup. This route previously had NONE — a duplicate call
  // (a manual test, a retry, a mistaken re-trigger) re-blasted the whole pool
  // with no guard at all, which is exactly what happened during testing on
  // 2026-09-12. Same pattern as post-lock-summary: a single existence-check
  // row per season+week, entryId left null since this is one broadcast.
  const already = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(
        eq(notifications.seasonId, season.id),
        eq(notifications.week, summaryWeek),
        eq(notifications.kind, "tue_summary"),
      ),
    )
    .limit(1);
  if (already.length > 0) {
    return NextResponse.json({ ok: true, note: "already sent this week" });
  }

  const active = await getActiveEntries(season.id);

  const elimRows = await db
    .select({
      id: entries.id,
      displayName: user.displayName,
      name: user.name,
      email: user.email,
    })
    .from(entries)
    .innerJoin(user, eq(entries.userId, user.id))
    .where(
      and(
        eq(entries.seasonId, season.id),
        eq(entries.eliminatedWeek, summaryWeek),
      ),
    );

  const pickRows = await db
    .select({ entryId: picks.entryId, teamAbbr: picks.teamAbbr })
    .from(picks)
    .where(and(eq(picks.seasonId, season.id), eq(picks.week, summaryWeek)));
  const pickByEntry = new Map(pickRows.map((p) => [p.entryId, p.teamAbbr]));

  const eliminated = elimRows.map((e) => ({
    name: e.displayName || e.name || e.email.split("@")[0] || "player",
    pick: pickByEntry.get(e.id) ?? null,
  }));

  const { subject, html } = weekSummaryEmail({
    year: season.year,
    week: summaryWeek,
    eliminated,
    mainAlive: active.filter((e) => e.bracket === "main").map((e) => e.name),
    losersAlive: active.filter((e) => e.bracket === "losers").map((e) => e.name),
    nextWeek: summaryWeek + 1,
  });

  // Send individually rather than one message with everyone in `to:` — a shared
  // to-list would expose every player's address to the whole pool, and a single
  // bad address would fail the entire recap.
  const recipients = active.map((e) => e.email).filter(Boolean);
  const { sent, failed } = await sendEachEmail(recipients, subject, html);

  await db.insert(notifications).values({
    seasonId: season.id,
    week: summaryWeek,
    kind: "tue_summary",
    entryId: null,
  });

  await heartbeat(
    "tue-summary",
    `Recapped week ${summaryWeek}. Sent ${sent}, failed ${failed.length}.`,
  );

  return NextResponse.json({ ok: true, sent, failed: failed.length });
}
