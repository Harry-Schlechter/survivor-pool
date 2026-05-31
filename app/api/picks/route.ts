import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { validatePick } from "@/lib/picks";

const Body = z.object({
  teamAbbr: z.string().min(2).max(4),
});

// Authoritative pick submission. Re-validates every rule server-side; RLS is the
// final backstop. Picks are upserted (one per entry per week) before lock.
export async function POST(request: NextRequest) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const { teamAbbr } = parsed.data;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Load season + my entry + this week's games + my prior picks (same bracket).
  const { data: season } = await supabase
    .from("seasons")
    .select("*")
    .neq("status", "archived")
    .order("year", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!season || season.status !== "active") {
    return NextResponse.json({ error: "no_active_season" }, { status: 400 });
  }

  const { data: entry } = await supabase
    .from("entries")
    .select("*")
    .eq("season_id", season.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!entry) {
    return NextResponse.json({ error: "not_in_season" }, { status: 400 });
  }

  const { data: games } = await supabase
    .from("games")
    .select("home_abbr,away_abbr")
    .eq("season_id", season.id)
    .eq("week", season.current_week);

  const { data: priorPicks } = await supabase
    .from("picks")
    .select("team_abbr,week,bracket")
    .eq("entry_id", entry.id)
    .eq("bracket", entry.bracket === "losers" ? "losers" : "main");

  const pickBracket = entry.bracket === "losers" ? "losers" : "main";
  const priorTeamAbbrs = (priorPicks ?? [])
    .filter((p) => p.week !== season.current_week) // exclude this week (re-pick)
    .map((p) => p.team_abbr);

  const result = validatePick({
    teamAbbr,
    bracket: pickBracket,
    phase: season.phase,
    lockAt: season.lock_at,
    now: new Date(),
    weekGames: (games ?? []).map((g) => ({
      homeAbbr: g.home_abbr,
      awayAbbr: g.away_abbr,
    })),
    priorTeamAbbrsThisBracket: priorTeamAbbrs,
    entryPaid: entry.paid,
    entryActive: entry.bracket === "main" || entry.bracket === "losers",
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }

  // Upsert the pick (unique on entry_id+week). RLS enforces ownership/lock.
  const { error } = await supabase.from("picks").upsert(
    {
      entry_id: entry.id,
      season_id: season.id,
      week: season.current_week,
      team_abbr: teamAbbr,
      bracket: pickBracket,
      result: "pending",
    },
    { onConflict: "entry_id,week" },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
