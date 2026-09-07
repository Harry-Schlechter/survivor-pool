import { db } from "@/lib/db";
import { user, entries, picks, seasons } from "@/lib/db/schema";
import { eq, inArray, ne, desc } from "drizzle-orm";

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

/**
 * All of a user's entries + picks across seasons (for career stats).
 *
 * Pre-lock privacy: a player's pick for the current week is hidden from
 * everyone but themselves, matching getStandings(). Without `viewerUserId`
 * the current week is treated as hidden — callers must opt in to seeing it.
 * The pick row is kept but its team is redacted to null, so the week still
 * appears as "made a pick" and the totals stay honest; dropping the row
 * outright would also skew the most-picked-team stat.
 */
export async function getCareerData(userId: string, viewerUserId?: string) {
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

  // Which (season, week) is currently unlocked? Only that one is sensitive.
  const isOwnProfile = viewerUserId === userId;
  let hiddenSeasonId: string | null = null;
  let hiddenWeek: number | null = null;
  if (!isOwnProfile) {
    const live = await db
      .select({
        id: seasons.id,
        currentWeek: seasons.currentWeek,
        lockAt: seasons.lockAt,
      })
      .from(seasons)
      .where(ne(seasons.status, "archived"))
      .orderBy(desc(seasons.year))
      .limit(1);
    const season = live[0];
    const locked = !!season?.lockAt && new Date() >= new Date(season.lockAt);
    if (season && !locked) {
      hiddenSeasonId = season.id;
      hiddenWeek = season.currentWeek;
    }
  }

  const visiblePicks = pickRows.map((p) =>
    p.season_id === hiddenSeasonId && p.week === hiddenWeek
      ? { ...p, team_abbr: null }
      : p,
  );

  return { entries: entryRows, picks: visiblePicks };
}
