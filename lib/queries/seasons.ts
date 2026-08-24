import { db } from "@/lib/db";
import { seasons, entries } from "@/lib/db/schema";
import { and, eq, ne, desc } from "drizzle-orm";
import type { SeasonRow, EntryRow } from "@/lib/db/schema";

/** The current non-archived season (signup/active/complete), newest first. */
export async function getCurrentSeason(): Promise<SeasonRow | null> {
  const rows = await db
    .select()
    .from(seasons)
    .where(ne(seasons.status, "archived"))
    .orderBy(desc(seasons.year))
    .limit(1);
  return rows[0] ?? null;
}

/** The active season (status='active'), if any. Used by scheduled jobs. */
export async function getActiveSeason(): Promise<SeasonRow | null> {
  const rows = await db
    .select()
    .from(seasons)
    .where(eq(seasons.status, "active"))
    .orderBy(desc(seasons.year))
    .limit(1);
  return rows[0] ?? null;
}

/** The current signup-status season, if signups are open. */
/**
 * The season people may currently join.
 *
 * Signups are NOT limited to status='signup': the league goes active as soon
 * as it opens, and latecomers can still join mid-signup-window. What actually
 * closes signups is the week-1 lock (first kickoff of the season), enforced by
 * signupsOpen() below.
 */
export async function getSignupSeason(): Promise<SeasonRow | null> {
  const rows = await db
    .select()
    .from(seasons)
    .where(ne(seasons.status, "archived"))
    .orderBy(desc(seasons.year))
    .limit(1);
  const season = rows[0];
  if (!season) return null;
  return signupsOpen(season) ? season : null;
}

/**
 * Signups close at the first kickoff of the season — the same moment week-1
 * picks lock. Before a lock time exists (pre-schedule-sync) they're open.
 */
export function signupsOpen(season: SeasonRow, now: Date = new Date()): boolean {
  if (season.status === "complete" || season.status === "archived") return false;
  // Only week 1 gates signups; past week 1 the season is underway.
  if (season.currentWeek > 1) return false;
  if (!season.lockAt) return true;
  return now < new Date(season.lockAt);
}

export async function getSeasonById(id: string): Promise<SeasonRow | null> {
  const rows = await db.select().from(seasons).where(eq(seasons.id, id)).limit(1);
  return rows[0] ?? null;
}

/** A user's entry in a season, if they've joined. */
export async function getEntry(
  seasonId: string,
  userId: string,
): Promise<EntryRow | null> {
  const rows = await db
    .select()
    .from(entries)
    .where(and(eq(entries.seasonId, seasonId), eq(entries.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}
