import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/guards";
import { getCurrentSeason, getEntry } from "@/lib/queries/seasons";
import {
  getWeekGames,
  getEntrySeasonPicks,
  upsertPick,
} from "@/lib/queries/picks";
import { validatePick } from "@/lib/picks";

const Body = z.object({ teamAbbr: z.string().min(2).max(4) });

// Authoritative pick submission. Re-validates every rule server-side (there's no
// DB-level RLS anymore, so this IS the gate). One pick per entry per week.
export async function POST(request: NextRequest) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const { teamAbbr } = parsed.data;

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const season = await getCurrentSeason();
  if (!season || season.status !== "active") {
    return NextResponse.json({ error: "no_active_season" }, { status: 400 });
  }

  const entry = await getEntry(season.id, user.id);
  if (!entry) {
    return NextResponse.json({ error: "not_in_season" }, { status: 400 });
  }

  const pickBracket = entry.bracket === "losers" ? "losers" : "main";
  const weekGames = await getWeekGames(season.id, season.currentWeek);
  // Season-wide, not per-bracket: the two-use cap follows the player across a
  // drop into the losers bracket.
  const priorPicks = await getEntrySeasonPicks(entry.id);
  const priorTeamAbbrs = priorPicks
    .filter((p) => p.week !== season.currentWeek) // exclude this week (re-pick)
    .map((p) => p.teamAbbr);

  const result = validatePick({
    teamAbbr,
    bracket: pickBracket,
    phase: season.phase as "regular" | "playoffs",
    lockAt: season.lockAt ? season.lockAt.toISOString() : null,
    now: new Date(),
    weekGames: weekGames.map((g) => ({
      homeAbbr: g.homeAbbr,
      awayAbbr: g.awayAbbr,
    })),
    priorTeamAbbrsThisSeason: priorTeamAbbrs,
    entryPaid: entry.paid,
    entryActive: entry.bracket === "main" || entry.bracket === "losers",
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }

  await upsertPick({
    entryId: entry.id,
    seasonId: season.id,
    week: season.currentWeek,
    teamAbbr,
    bracket: pickBracket,
  });

  return NextResponse.json({ ok: true });
}
