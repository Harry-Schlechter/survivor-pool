// Called Tuesday ~3am ET by GitHub Actions (see .github/workflows/cron.yml).
// The ONLY thing that grades picks, moves brackets, and pulls in new
// games/odds — once a week, once everything is final. Deliberately simple:
//   1. Final-grade the week's picks (win/loss, bracket transitions). Guarded
//      inside syncAndGradeCurrentWeek so this is a no-op unless every one of
//      the week's games is actually completed (see lib/season-ops.ts) —
//      Tuesday 3am is always well after Monday Night Football, so this is
//      the moment grading is finally safe to do for real.
//   2. Advance to the next week — auto-flipping into the playoffs after the
//      regular season (week 18), following ESPN's real calendar.
//   3. Recompute lock_at and pull in the new week's games/odds (first
//      kickoff of the new week).
// There used to also be a separate twice-daily sync-scores job pulling
// scores/odds throughout the week. Removed: the site never showed live
// scores anyway, and every grading bug so far (players eliminated before a
// week was even played, or double-eliminated by a repeat grading pass) came
// from grading running more often than the once-a-week cadence the rules
// actually need. One job, once a week, is the whole design now.
//
// rolloverWeek()/advanceWeek() have NO built-in re-entrancy guard of their
// own — advanceWeek unconditionally increments currentWeek on every call.
// The old Netlify function was only ever safe because its weekday/hour ET
// check prevented a second same-day call; that protection disappears with
// the scheduler, so it is re-implemented here: refuse to roll over again if
// the season was already updated (by this route) within the last 20 hours.
// A GitHub Actions retry or an accidental double-trigger can no longer
// double-advance the week.
//
// Sends NO email — weekly summaries/reminders are the separate routes.
//
// Replaces the Netlify Scheduled Function of the same name: that trigger
// silently stopped firing site-wide (see lib/cron/shared.ts for the story).

import { type NextRequest, NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/cron/auth";
import { getActiveSeason, heartbeat } from "@/lib/cron/shared";
import { rolloverWeek } from "@/lib/season-ops";

const MIN_HOURS_BETWEEN_ROLLOVERS = 20;

export async function POST(request: NextRequest) {
  const unauthorized = requireCronSecret(request);
  if (unauthorized) return unauthorized;

  const season = await getActiveSeason();
  if (!season) {
    return NextResponse.json({ ok: true, note: "no active season" });
  }

  const hoursSinceUpdate =
    (Date.now() - new Date(season.updatedAt).getTime()) / 3_600_000;
  if (hoursSinceUpdate < MIN_HOURS_BETWEEN_ROLLOVERS) {
    return NextResponse.json({
      ok: true,
      note: `already rolled over ${hoursSinceUpdate.toFixed(1)}h ago — skipping`,
    });
  }

  const report = await rolloverWeek(season);

  await heartbeat("weekly-rollover", `Rolled over. ${JSON.stringify(report)}`);

  return NextResponse.json({ ok: true, ...report });
}
