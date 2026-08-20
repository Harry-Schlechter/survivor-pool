import { db } from "@/lib/db";
import { picks, games } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import type { PickBracket } from "@/lib/db/schema";

/** This week's games for a season, ordered by kickoff. */
export async function getWeekGames(seasonId: string, week: number) {
  return db
    .select()
    .from(games)
    .where(and(eq(games.seasonId, seasonId), eq(games.week, week)))
    .orderBy(games.kickoff);
}

/**
 * An entry's prior picks for the whole season (for the 2x-usage rule).
 *
 * Deliberately NOT scoped to a bracket: the two-use cap runs across the entire
 * season, so picks made in the winners pool still count against a player after
 * they drop to the losers bracket.
 */
export async function getEntrySeasonPicks(entryId: string) {
  return db
    .select({ teamAbbr: picks.teamAbbr, week: picks.week, bracket: picks.bracket })
    .from(picks)
    .where(eq(picks.entryId, entryId));
}

/** An entry's pick for a given week, if any. */
export async function getEntryWeekPick(entryId: string, week: number) {
  const rows = await db
    .select({ teamAbbr: picks.teamAbbr })
    .from(picks)
    .where(and(eq(picks.entryId, entryId), eq(picks.week, week)))
    .limit(1);
  return rows[0] ?? null;
}

/** Upsert a pick (one per entry per week). */
export async function upsertPick(args: {
  entryId: string;
  seasonId: string;
  week: number;
  teamAbbr: string;
  bracket: PickBracket;
}) {
  await db
    .insert(picks)
    .values({
      entryId: args.entryId,
      seasonId: args.seasonId,
      week: args.week,
      teamAbbr: args.teamAbbr,
      bracket: args.bracket,
      result: "pending",
    })
    .onConflictDoUpdate({
      target: [picks.entryId, picks.week],
      set: {
        teamAbbr: args.teamAbbr,
        bracket: args.bracket,
        result: "pending",
        updatedAt: new Date(),
      },
    });
}
