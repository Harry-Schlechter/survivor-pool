// Runs every 15 min (netlify.toml). Pulls ESPN scores for the active season's
// current week and grades whatever is final. Cheap + idempotent; early-returns
// when there's no active season.

import type { Config } from "@netlify/functions";
import { getActiveSeason } from "./_shared";
import { syncAndGradeCurrentWeek } from "../../lib/season-ops";

export default async function handler() {
  const season = await getActiveSeason();
  if (!season) return new Response("no active season", { status: 200 });

  const report = await syncAndGradeCurrentWeek(season);
  return Response.json({ ok: true, ...report });
}

export const config: Config = {
  schedule: "*/15 * * * *",
};
