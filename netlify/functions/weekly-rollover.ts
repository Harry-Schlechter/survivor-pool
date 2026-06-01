// Tuesday ~3am ET weekly rollover (the hands-off heartbeat of a season):
//   1. Final-grade the week's picks (win/loss, bracket transitions).
//   2. Advance to the next week — auto-flipping into the playoffs after the
//      regular season (week 18), following ESPN's real calendar.
//   3. Recompute lock_at = the first kickoff of the new week.
//
// Cron fires at both 07:00 and 08:00 UTC (covers EDT and EST); the ET-window
// guard ensures it actually executes once, at ~3am ET. Idempotent: a second
// fire in the same window early-returns because the week already advanced.
//
// Sends NO email — weekly summaries/reminders are the separate jobs.

import type { Config } from "@netlify/functions";
import { getActiveSeason, nowET } from "./_shared";
import { rolloverWeek } from "../../lib/season-ops";

export default async function handler() {
  const et = nowET();
  // Tuesday, 3am ET (allow 3:00–3:59 to absorb cron jitter / the dual UTC fire).
  if (et.weekday !== 2 || et.hour !== 3) {
    return new Response("outside Tue 3am ET window", { status: 200 });
  }

  const season = await getActiveSeason();
  if (!season) return new Response("no active season", { status: 200 });

  const report = await rolloverWeek(season);
  return Response.json({ ok: true, ...report });
}

export const config: Config = {
  // 07:00 UTC = 3am EDT, 08:00 UTC = 3am EST. Handler runs only in the 3am ET hour.
  schedule: "0 7,8 * * 2",
};
