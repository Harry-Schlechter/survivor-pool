import { db } from "@/lib/db";
import { user, entries, picks } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";

/** A user's public profile (display name) for the profile page. */
export async function getProfile(userId: string) {
  const rows = await db
    .select({
      id: user.id,
      displayName: user.displayName,
      name: user.name,
      email: user.email,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    displayName: r.displayName || r.name || r.email.split("@")[0] || "player",
  };
}

/** All of a user's entries + picks across seasons (for career stats). */
export async function getCareerData(userId: string) {
  const entryRows = await db
    .select({
      id: entries.id,
      season_id: entries.seasonId,
      eliminated_week: entries.eliminatedWeek,
      final_rank: entries.finalRank,
    })
    .from(entries)
    .where(eq(entries.userId, userId));

  const entryIds = entryRows.map((e) => e.id);
  const pickRows =
    entryIds.length > 0
      ? await db
          .select({
            entry_id: picks.entryId,
            season_id: picks.seasonId,
            week: picks.week,
            team_abbr: picks.teamAbbr,
            result: picks.result,
          })
          .from(picks)
          .where(inArray(picks.entryId, entryIds))
      : [];

  return { entries: entryRows, picks: pickRows };
}
