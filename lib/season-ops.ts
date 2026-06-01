// Server-side orchestration bridging the pure rule functions to the Neon DB via
// Drizzle. Imported by admin server actions and Netlify scheduled functions
// ONLY — never from client code.

import { db } from "@/lib/db";
import { games, entries, picks, seasons } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import type { SeasonRow } from "@/lib/db/schema";
import { fetchWeek, earliestKickoff, type NormalizedGame } from "@/lib/espn";
import { gradeWeek, type GradeInput } from "@/lib/grading";

/** Map season phase + week to ESPN seasontype + week. */
function espnParams(season: SeasonRow): { seasontype: 1 | 2 | 3; week: number } {
  return season.phase === "playoffs"
    ? { seasontype: 3, week: season.currentWeek }
    : { seasontype: 2, week: season.currentWeek };
}

/** Upsert ESPN games for a season+week into the games table. */
export async function syncWeekGames(
  season: SeasonRow,
): Promise<NormalizedGame[]> {
  const { seasontype, week } = espnParams(season);
  const fetched = await fetchWeek(season.year, week, seasontype);
  if (fetched.length === 0) return [];

  for (const g of fetched) {
    await db
      .insert(games)
      .values({
        id: g.id,
        seasonId: season.id,
        week: g.week,
        seasontype: g.seasontype,
        homeAbbr: g.homeAbbr,
        awayAbbr: g.awayAbbr,
        homeName: g.homeName,
        awayName: g.awayName,
        kickoff: new Date(g.kickoff),
        status: g.status,
        completed: g.completed,
        homeScore: g.homeScore,
        awayScore: g.awayScore,
        winnerAbbr: g.winnerAbbr,
        spreadDetail: g.spreadDetail,
        overUnder: g.overUnder != null ? String(g.overUnder) : null,
      })
      .onConflictDoUpdate({
        target: [games.seasonId, games.id],
        set: {
          status: g.status,
          completed: g.completed,
          homeScore: g.homeScore,
          awayScore: g.awayScore,
          winnerAbbr: g.winnerAbbr,
          spreadDetail: g.spreadDetail,
          overUnder: g.overUnder != null ? String(g.overUnder) : null,
          kickoff: new Date(g.kickoff),
          updatedAt: new Date(),
        },
      });
  }
  return fetched;
}

/** Recompute and persist lock_at (earliest kickoff of the current week). */
export async function refreshLockAt(season: SeasonRow): Promise<Date | null> {
  const fetched = await syncWeekGames(season);
  const lockIso = earliestKickoff(fetched);
  const lockAt = lockIso ? new Date(lockIso) : null;
  await db.update(seasons).set({ lockAt }).where(eq(seasons.id, season.id));
  return lockAt;
}

function resultsByTeam(
  rows: {
    homeAbbr: string;
    awayAbbr: string;
    winnerAbbr: string | null;
    completed: boolean;
  }[],
): GradeInput["resultsByTeam"] {
  const map: GradeInput["resultsByTeam"] = {};
  for (const g of rows) {
    const r = { winnerAbbr: g.winnerAbbr, completed: g.completed };
    map[g.homeAbbr] = r;
    map[g.awayAbbr] = r;
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
 * Sync the current week's scores then grade. Idempotent; safe from cron or the
 * admin button. Only mutates when games are final.
 */
export async function syncAndGradeCurrentWeek(
  season: SeasonRow,
): Promise<GradeReport> {
  await syncWeekGames(season);
  const week = season.currentWeek;

  const gameRows = await db
    .select({
      homeAbbr: games.homeAbbr,
      awayAbbr: games.awayAbbr,
      winnerAbbr: games.winnerAbbr,
      completed: games.completed,
    })
    .from(games)
    .where(and(eq(games.seasonId, season.id), eq(games.week, week)));

  const entryRows = await db
    .select({
      id: entries.id,
      bracket: entries.bracket,
      eliminatedWeek: entries.eliminatedWeek,
    })
    .from(entries)
    .where(and(eq(entries.seasonId, season.id), eq(entries.paid, true)));

  const pickRows = await db
    .select({
      entryId: picks.entryId,
      teamAbbr: picks.teamAbbr,
      bracket: picks.bracket,
    })
    .from(picks)
    .where(and(eq(picks.seasonId, season.id), eq(picks.week, week)));

  const out = gradeWeek({
    week,
    entries: entryRows.map((e) => ({
      id: e.id,
      bracket: e.bracket as GradeInput["entries"][number]["bracket"],
      eliminated_week: e.eliminatedWeek,
    })),
    picks: pickRows.map((p) => ({
      entry_id: p.entryId,
      team_abbr: p.teamAbbr,
      bracket: p.bracket as "main" | "losers",
    })),
    resultsByTeam: resultsByTeam(gameRows),
  });

  for (const pu of out.pickUpdates) {
    await db
      .update(picks)
      .set({ result: pu.result })
      .where(
        and(
          eq(picks.seasonId, season.id),
          eq(picks.week, week),
          eq(picks.entryId, pu.entry_id),
        ),
      );
  }

  for (const eu of out.entryUpdates) {
    await db
      .update(entries)
      .set({ bracket: eu.bracket, eliminatedWeek: eu.eliminated_week })
      .where(eq(entries.id, eu.id));
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
  season: SeasonRow,
): Promise<{ week: number; lockAt: Date | null }> {
  const nextWeek = season.currentWeek + 1;
  const updated: SeasonRow = { ...season, currentWeek: nextWeek };
  const lockAt = await refreshLockAt(updated);
  await db
    .update(seasons)
    .set({ currentWeek: nextWeek })
    .where(eq(seasons.id, season.id));
  return { week: nextWeek, lockAt };
}
