// Standings query helpers used by the dashboard. Reads via the caller-provided
// (RLS-governed) server client so pick visibility honors the lock time.

import type { createClient } from "@/lib/supabase/server";
import type { Bracket } from "@/lib/database.types";

// Derive the client type from our own server factory so it matches exactly what
// callers pass (avoids SupabaseClient generic-arity mismatches across versions).
type Client = ReturnType<typeof createClient>;

export interface StandingRow {
  entryId: string;
  userId: string;
  displayName: string;
  bracket: Bracket;
  eliminatedWeek: number | null;
  thisWeekPick: string | null; // team_abbr or null (hidden/none)
  thisWeekResult: "pending" | "win" | "loss" | null;
}

export interface Standings {
  main: StandingRow[];
  losers: StandingRow[];
  eliminated: StandingRow[];
  locked: boolean;
}

export async function getStandings(
  supabase: Client,
  seasonId: string,
  week: number,
  lockAt: string | null,
): Promise<Standings> {
  const locked = !!lockAt && new Date() >= new Date(lockAt);

  const { data: entries } = await supabase
    .from("entries")
    .select("id,user_id,bracket,eliminated_week,paid,profiles(display_name)")
    .eq("season_id", seasonId)
    .eq("paid", true);

  // Picks for this week (RLS hides others' until lock; your own always visible).
  const { data: picks } = await supabase
    .from("picks")
    .select("entry_id,team_abbr,result")
    .eq("season_id", seasonId)
    .eq("week", week);

  const pickByEntry = new Map(
    (picks ?? []).map((p) => [p.entry_id, p]),
  );

  const rows: StandingRow[] = (entries ?? []).map((e) => {
    // Supabase returns the joined relation as an object or array depending on
    // the FK cardinality; normalize. (Hand-authored types don't model the
    // embed, so go through unknown.)
    const profiles = (e as unknown as {
      profiles: { display_name: string } | { display_name: string }[] | null;
    }).profiles;
    const prof = Array.isArray(profiles) ? profiles[0] : profiles;
    const pick = pickByEntry.get(e.id);
    return {
      entryId: e.id,
      userId: e.user_id,
      displayName: prof?.display_name || "player",
      bracket: e.bracket,
      eliminatedWeek: e.eliminated_week,
      thisWeekPick: pick?.team_abbr ?? null,
      thisWeekResult: (pick?.result as StandingRow["thisWeekResult"]) ?? null,
    };
  });

  const byName = (a: StandingRow, b: StandingRow) =>
    a.displayName.localeCompare(b.displayName);

  return {
    main: rows.filter((r) => r.bracket === "main").sort(byName),
    losers: rows.filter((r) => r.bracket === "losers").sort(byName),
    eliminated: rows
      .filter((r) => r.bracket === "eliminated")
      .sort((a, b) => (a.eliminatedWeek ?? 0) - (b.eliminatedWeek ?? 0)),
    locked,
  };
}
