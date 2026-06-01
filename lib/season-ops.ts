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

// NFL regular season is weeks 1-18 (ESPN seasontype 2). After week 18 the
// playoffs begin (seasontype 3): week 1 = Wild Card ... week 4 = Super Bowl.
const REGULAR_SEASON_WEEKS = 18;

/** Count entries still alive (main or losers) in a season. */
export async function aliveCount(seasonId: string): Promise<number> {
  const rows = await db
    .select({ bracket: entries.bracket })
    .from(entries)
    .where(and(eq(entries.seasonId, seasonId), eq(entries.paid, true)));
  return rows.filter((r) => r.bracket === "main" || r.bracket === "losers")
    .length;
}

export interface AdvanceResult {
  phase: "regular" | "playoffs";
  week: number;
  lockAt: Date | null;
  enteredPlayoffs: boolean;
}

/**
 * Advance to the next week and refresh its lock time. Crossing from regular-
 * season week 18 into the playoffs flips `phase` to 'playoffs' and resets the
 * week counter to postseason week 1 (Wild Card) — so the regular→playoffs
 * transition follows the real NFL calendar via ESPN's seasontype, no dates.
 */
export async function advanceWeek(season: SeasonRow): Promise<AdvanceResult> {
  let nextPhase: "regular" | "playoffs" = season.phase as
    | "regular"
    | "playoffs";
  let nextWeek = season.currentWeek + 1;
  let enteredPlayoffs = false;

  if (season.phase === "regular" && season.currentWeek >= REGULAR_SEASON_WEEKS) {
    nextPhase = "playoffs";
    nextWeek = 1; // ESPN postseason week 1 = Wild Card
    enteredPlayoffs = true;
  }

  await db
    .update(seasons)
    .set({ phase: nextPhase, currentWeek: nextWeek })
    .where(eq(seasons.id, season.id));

  const updated: SeasonRow = {
    ...season,
    phase: nextPhase,
    currentWeek: nextWeek,
  };
  const lockAt = await refreshLockAt(updated);
  return { phase: nextPhase, week: nextWeek, lockAt, enteredPlayoffs };
}

export interface RolloverReport {
  ran: boolean;
  grade: GradeReport | null;
  advanced: AdvanceResult | null;
  completed: boolean;
  note: string;
}

/**
 * The weekly Tuesday-3am-ET rollover. Idempotent and safe to re-run:
 *   1. Final-grade the current week (grades whatever is final; pending picks on
 *      unfinished games stay pending and the 15-min sync settles them later).
 *   2. Advance to the next week (regular→playoffs auto-flip after week 18).
 *   3. Recompute lock_at = first kickoff of the new week.
 * If nobody is left alive after grading, the season is marked complete instead
 * of advancing. Sends NO email — that's the separate summary/reminder jobs.
 */
export async function rolloverWeek(season: SeasonRow): Promise<RolloverReport> {
  const grade = await syncAndGradeCurrentWeek(season);

  // Re-read alive count after grading.
  const alive = await aliveCount(season.id);
  if (alive === 0) {
    await db
      .update(seasons)
      .set({ status: "complete" })
      .where(eq(seasons.id, season.id));
    return {
      ran: true,
      grade,
      advanced: null,
      completed: true,
      note: "No players remain — season marked complete.",
    };
  }

  // Re-read the season (phase/week may be unchanged but be explicit).
  const fresh =
    (await db.select().from(seasons).where(eq(seasons.id, season.id)).limit(1))[0] ??
    season;
  const advanced = await advanceWeek(fresh);

  // If we just advanced into the playoffs but ESPN returned no games for the new
  // week (e.g. season truly over), complete the season.
  if (advanced.lockAt === null && advanced.enteredPlayoffs) {
    const games2 = await syncWeekGames({
      ...fresh,
      phase: advanced.phase,
      currentWeek: advanced.week,
    });
    if (games2.length === 0) {
      await db
        .update(seasons)
        .set({ status: "complete" })
        .where(eq(seasons.id, season.id));
      return {
        ran: true,
        grade,
        advanced,
        completed: true,
        note: "No postseason games found — season complete.",
      };
    }
  }

  return {
    ran: true,
    grade,
    advanced,
    completed: false,
    note: advanced.enteredPlayoffs
      ? `Entered playoffs (week ${advanced.week}).`
      : `Advanced to week ${advanced.week}.`,
  };
}
