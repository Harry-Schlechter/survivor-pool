// Called by GitHub Actions twice a day (see .github/workflows/cron.yml).
// Pulls ESPN odds + scores for the active season's current week and grades
// whatever is final. Odds only need refreshing a couple times a day once the
// week's schedule is set, and score grading doesn't need to be real-time —
// weekly-rollover does its own final grading pass Tuesday 3am regardless.
// Idempotent either way.
//
// Replaces the Netlify Scheduled Function of the same name: that trigger
// silently stopped firing site-wide (see lib/cron/shared.ts for the story).

import { type NextRequest, NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/cron/auth";
import { getActiveSeason, heartbeat } from "@/lib/cron/shared";
import { syncAndGradeCurrentWeek } from "@/lib/season-ops";

export async function POST(request: NextRequest) {
  const unauthorized = requireCronSecret(request);
  if (unauthorized) return unauthorized;

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
