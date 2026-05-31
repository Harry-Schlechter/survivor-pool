// Runs every 15 min (netlify.toml). Pulls ESPN scores for the active season's
// current week and grades whatever is final. Cheap + idempotent; early-returns
// when there's no active season.

import type { Config } from "@netlify/functions";
import { adminClient, getActiveSeason } from "./_shared";
import { syncAndGradeCurrentWeek } from "../../lib/season-ops";

export default async function handler() {
  const admin = adminClient();
  const season = await getActiveSeason(admin);
  if (!season) return new Response("no active season", { status: 200 });

  const report = await syncAndGradeCurrentWeek(admin, season);
  return Response.json({ ok: true, ...report });
}

export const config: Config = {
  schedule: "*/15 * * * *",
};
