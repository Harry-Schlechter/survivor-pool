// Server-side orchestration that bridges the pure rule functions to Supabase
// using the SERVICE-ROLE client (bypasses RLS). Imported by admin route
// handlers and Netlify scheduled functions ONLY — never from client code.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, SeasonRow } from "./database.types";
import { fetchWeek, earliestKickoff, type NormalizedGame } from "./espn";
import { gradeWeek, type GradeInput } from "./grading";

type Admin = SupabaseClient<Database>;

/** Map our season phase + week to ESPN's seasontype + week numbering.
 *  Regular season: weeks 1-18, seasontype 2.
 *  Playoffs: seasontype 3, week 1=Wild Card ... handled by storing the ESPN
 *  week directly; admin sets current_week to the ESPN postseason week. */
function espnParams(season: SeasonRow): { seasontype: 1 | 2 | 3; week: number } {
  return season.phase === "playoffs"
    ? { seasontype: 3, week: season.current_week }
    : { seasontype: 2, week: season.current_week };
}

/** Upsert ESPN games for a season+week into the games table. Returns the rows. */
export async function syncWeekGames(
  admin: Admin,
  season: SeasonRow,
): Promise<NormalizedGame[]> {
  const { seasontype, week } = espnParams(season);
  const games = await fetchWeek(season.year, week, seasontype);
  if (games.length === 0) return [];

  const rows = games.map((g) => ({
    id: g.id,
    season_id: season.id,
    week: g.week,
    seasontype: g.seasontype,
    home_abbr: g.homeAbbr,
    away_abbr: g.awayAbbr,
    home_name: g.homeName,
    away_name: g.awayName,
    kickoff: g.kickoff,
    status: g.status,
    completed: g.completed,
    home_score: g.homeScore,
    away_score: g.awayScore,
    winner_abbr: g.winnerAbbr,
    spread_detail: g.spreadDetail,
    over_under: g.overUnder,
  }));

  const { error } = await admin
    .from("games")
    .upsert(rows, { onConflict: "season_id,id" });
  if (error) throw new Error(`games upsert failed: ${error.message}`);

  return games;
}

/** Recompute and persist lock_at (earliest kickoff of the current week). */
export async function refreshLockAt(
  admin: Admin,
  season: SeasonRow,
): Promise<string | null> {
  const games = await syncWeekGames(admin, season);
  const lockAt = earliestKickoff(games);
  const { error } = await admin
    .from("seasons")
    .update({ lock_at: lockAt })
    .eq("id", season.id);
  if (error) throw new Error(`lock_at update failed: ${error.message}`);
  return lockAt;
}

/** Build resultsByTeam from games rows. */
function resultsByTeam(
  games: { home_abbr: string; away_abbr: string; winner_abbr: string | null; completed: boolean }[],
): GradeInput["resultsByTeam"] {
  const map: GradeInput["resultsByTeam"] = {};
  for (const g of games) {
    const r = { winnerAbbr: g.winner_abbr, completed: g.completed };
    map[g.home_abbr] = r;
    map[g.away_abbr] = r;
  }
  return map;
}

export interface GradeReport {
  graded: boolean;
  allFinal: boolean;
  entriesChanged: number;
  picksGraded: number;
}

/**
 * Sync the current week's scores then grade. Idempotent and safe to call from
 * the 15-min cron or the admin button. Only mutates picks/entries when games
 * are final; entries are advanced as soon as their own outcome is decided.
 */
export async function syncAndGradeCurrentWeek(
  admin: Admin,
  season: SeasonRow,
): Promise<GradeReport> {
  // 1) Pull fresh scores.
  await syncWeekGames(admin, season);

  const week = season.current_week;

  // 2) Load games, active entries, and this week's picks.
  const [{ data: games }, { data: entries }, { data: picks }] =
    await Promise.all([
      admin
        .from("games")
        .select("home_abbr,away_abbr,winner_abbr,completed")
        .eq("season_id", season.id)
        .eq("week", week),
      admin
        .from("entries")
        .select("id,bracket,eliminated_week")
        .eq("season_id", season.id)
        .eq("paid", true),
      admin
        .from("picks")
        .select("entry_id,team_abbr,bracket")
        .eq("season_id", season.id)
        .eq("week", week),
    ]);

  if (!games || !entries) {
    return { graded: false, allFinal: false, entriesChanged: 0, picksGraded: 0 };
  }

  const out = gradeWeek({
    week,
    entries: entries.map((e) => ({
      id: e.id,
      bracket: e.bracket,
      eliminated_week: e.eliminated_week,
    })),
    picks: (picks ?? []).map((p) => ({
      entry_id: p.entry_id,
      team_abbr: p.team_abbr,
      bracket: p.bracket,
    })),
    resultsByTeam: resultsByTeam(games),
  });

  // 3) Apply pick results.
  for (const pu of out.pickUpdates) {
    await admin
      .from("picks")
      .update({ result: pu.result })
      .eq("season_id", season.id)
      .eq("week", week)
      .eq("entry_id", pu.entry_id);
  }

  // 4) Apply entry transitions.
  for (const eu of out.entryUpdates) {
    await admin
      .from("entries")
      .update({ bracket: eu.bracket, eliminated_week: eu.eliminated_week })
      .eq("id", eu.id);
  }

  return {
    graded: true,
    allFinal: out.allFinal,
    entriesChanged: out.entryUpdates.length,
    picksGraded: out.pickUpdates.length,
  };
}

/** Advance to the next week and refresh its lock time. */
export async function advanceWeek(
  admin: Admin,
  season: SeasonRow,
): Promise<{ week: number; lockAt: string | null }> {
  const nextWeek = season.current_week + 1;
  const updated: SeasonRow = { ...season, current_week: nextWeek };
  const lockAt = await refreshLockAt(admin, updated);
  await admin
    .from("seasons")
    .update({ current_week: nextWeek })
    .eq("id", season.id);
  return { week: nextWeek, lockAt };
}
