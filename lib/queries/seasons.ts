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
export async function getSignupSeason(): Promise<SeasonRow | null> {
  const rows = await db
    .select()
    .from(seasons)
    .where(eq(seasons.status, "signup"))
    .orderBy(desc(seasons.year))
    .limit(1);
  return rows[0] ?? null;
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
