// Runs twice a day, every day (netlify.toml). Pulls ESPN odds + scores for the
// active season's current week and grades whatever is final. Odds only need
// refreshing a couple times a day once the week's schedule is set, and score
// grading doesn't need to be real-time — the once-nightly cadence still keeps
// standings current within a day, and weekly-rollover does its own final
// grading pass Tuesday 3am regardless. Idempotent either way.

import type { Config } from "@netlify/functions";
import { getActiveSeason, nowET, heartbeat } from "./_shared";
import { syncAndGradeCurrentWeek } from "../../lib/season-ops";

export default async function handler() {
  const et = nowET();
  // Cron fires at both UTC hours that map to 8am/8pm ET (covers EDT/EST); this
  // guard keeps it to exactly two runs/day instead of four.
  if (et.hour !== 8 && et.hour !== 20) {
    return new Response("outside the 8am/8pm ET hours", { status: 200 });
  }

  const season = await getActiveSeason();
  if (!season) return new Response("no active season", { status: 200 });

  const report = await syncAndGradeCurrentWeek(season);

  await heartbeat(
    "sync-scores",
    `Week ${season.currentWeek}. Graded ${report.picksGraded} picks, ${report.entriesChanged} entries changed.`,
  );

  return Response.json({ ok: true, ...report });
}

export const config: Config = {
  // 12,13 UTC = 8am EDT/EST; 0,1 UTC = 8pm EDT/EST. The et.hour guard above
  // narrows each pair down to a single real run.
  schedule: "0 12,13,0,1 * * *",
};
