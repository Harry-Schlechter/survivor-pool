// Temporary diagnostic route — isolates which step of sync-scores throws in
// the deployed Netlify runtime after it worked fine locally via tsx.
// DELETE once the cause is found.
import { type NextRequest, NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/cron/auth";

export async function POST(request: NextRequest) {
  const unauthorized = requireCronSecret(request);
  if (unauthorized) return unauthorized;

  const steps: Record<string, string> = {};

  try {
    const { getActiveSeason } = await import("@/lib/cron/shared");
    const season = await getActiveSeason();
    steps.getActiveSeason = season ? `ok: ${season.year}` : "ok: null";

    if (season) {
      try {
        const { fetchWeek } = await import("@/lib/espn");
        const games = await fetchWeek(season.year, season.currentWeek, 2);
        steps.fetchWeek = `ok: ${games.length} games`;
      } catch (e) {
        steps.fetchWeek = `THREW: ${e instanceof Error ? e.message : String(e)}`;
      }

      try {
        const { syncWeekGames } = await import("@/lib/season-ops");
        await syncWeekGames(season);
        steps.syncWeekGames = "ok";
      } catch (e) {
        steps.syncWeekGames = `THREW: ${e instanceof Error ? e.message : String(e)}\n${e instanceof Error ? e.stack : ""}`;
      }
    }
  } catch (e) {
    steps.outer = `THREW: ${e instanceof Error ? e.message : String(e)}\n${e instanceof Error ? e.stack : ""}`;
  }

  return NextResponse.json(steps);
}
