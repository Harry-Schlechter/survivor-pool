// Called by GitHub Actions (see .github/workflows/cron.yml). Pulls ESPN odds
// + scores for the active season's current week and grades whatever is
// final. Odds only need refreshing a couple times a day once the week's
// schedule is set, and score grading doesn't need to be real-time —
// weekly-rollover does its own final grading pass Tuesday 3am regardless.
// Idempotent either way.
//
// The cron trigger fires at 4 fixed UTC hours a day (12, 13, 0, 1) so that
// ONE of each EDT/EST pair lands on 8am/8pm ET — but unlike thu-reminder and
// lock-reminder, this route had NO guard of its own filtering out the
// wrong-offset hour, so it ran on all 4 ticks: 4x/day, not the intended
// 2x/day. Found 2026-09-19 from the extra heartbeat emails. Fixed the same
// way the other lock-adjacent routes already do it: check the real ET hour.
//
// Replaces the Netlify Scheduled Function of the same name: that trigger
// silently stopped firing site-wide (see lib/cron/shared.ts for the story).

import { type NextRequest, NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/cron/auth";
import { getActiveSeason, heartbeat, nowET } from "@/lib/cron/shared";
import { syncAndGradeCurrentWeek } from "@/lib/season-ops";

export async function POST(request: NextRequest) {
  const unauthorized = requireCronSecret(request);
  if (unauthorized) return unauthorized;

  const et = nowET();
  if (et.hour !== 8 && et.hour !== 20) {
    return NextResponse.json({ ok: true, note: "outside the 8am/8pm ET hours" });
  }

  const season = await getActiveSeason();
  if (!season) {
    return NextResponse.json({ ok: true, note: "no active season" });
  }

  const report = await syncAndGradeCurrentWeek(season);

  await heartbeat(
    "sync-scores",
    `Week ${season.currentWeek}. Graded ${report.picksGraded} picks, ${report.entriesChanged} entries changed.`,
  );

  return NextResponse.json({ ok: true, ...report });
}
