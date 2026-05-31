// Profile/career stats aggregations. Pure computation over rows the page loads,
// so the math is testable independent of Supabase.

import type { EntryRow, PickRow } from "@/lib/database.types";

export interface CareerStats {
  seasonsPlayed: number;
  totalPicks: number;
  wins: number;
  losses: number;
  mostPickedTeam: { abbr: string; count: number } | null;
  avgEliminationWeek: number | null; // across seasons where they were eliminated
  avgFinalRank: number | null;
  bestFinish: number | null; // lowest final_rank
  currentStreak: number; // consecutive wins in the most recent season's picks
}

export function computeCareerStats(
  entries: Pick<EntryRow, "id" | "season_id" | "eliminated_week" | "final_rank">[],
  picks: Pick<PickRow, "entry_id" | "season_id" | "week" | "team_abbr" | "result">[],
): CareerStats {
  const wins = picks.filter((p) => p.result === "win").length;
  const losses = picks.filter((p) => p.result === "loss").length;

  // Most-picked team.
  const teamCounts = new Map<string, number>();
  for (const p of picks) {
    teamCounts.set(p.team_abbr, (teamCounts.get(p.team_abbr) ?? 0) + 1);
  }
  let mostPickedTeam: CareerStats["mostPickedTeam"] = null;
  for (const [abbr, count] of teamCounts) {
    if (!mostPickedTeam || count > mostPickedTeam.count) {
      mostPickedTeam = { abbr, count };
    }
  }

  const elimWeeks = entries
    .map((e) => e.eliminated_week)
    .filter((w): w is number => w != null);
  const avgEliminationWeek =
    elimWeeks.length > 0
      ? round1(elimWeeks.reduce((a, b) => a + b, 0) / elimWeeks.length)
      : null;

  const ranks = entries
    .map((e) => e.final_rank)
    .filter((r): r is number => r != null);
  const avgFinalRank =
    ranks.length > 0
      ? round1(ranks.reduce((a, b) => a + b, 0) / ranks.length)
      : null;
  const bestFinish = ranks.length > 0 ? Math.min(...ranks) : null;

  // Current streak: most recent season's picks in week order, count trailing wins.
  let currentStreak = 0;
  if (entries.length > 0) {
    const latestSeason = entries
      .map((e) => e.season_id)
      .sort()
      .at(-1);
    const seasonPicks = picks
      .filter((p) => p.season_id === latestSeason)
      .sort((a, b) => a.week - b.week);
    for (let i = seasonPicks.length - 1; i >= 0; i--) {
      if (seasonPicks[i].result === "win") currentStreak++;
      else break;
    }
  }

  return {
    seasonsPlayed: new Set(entries.map((e) => e.season_id)).size,
    totalPicks: picks.length,
    wins,
    losses,
    mostPickedTeam,
    avgEliminationWeek,
    avgFinalRank,
    bestFinish,
    currentStreak,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
