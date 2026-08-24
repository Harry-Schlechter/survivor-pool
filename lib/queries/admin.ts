import { db } from "@/lib/db";
import { entries, user } from "@/lib/db/schema";
import { and, eq, asc } from "drizzle-orm";

/** All entries in a season with the player's name/email (admin payment table). */
export async function getSeasonEntriesWithUser(seasonId: string) {
  const rows = await db
    .select({
      id: entries.id,
      paid: entries.paid,
      paidMarkedByUser: entries.paidMarkedByUser,
      bracket: entries.bracket,
      userId: entries.userId,
      displayName: user.displayName,
      name: user.name,
      email: user.email,
    })
    .from(entries)
    .innerJoin(user, eq(entries.userId, user.id))
    .where(eq(entries.seasonId, seasonId))
    .orderBy(asc(entries.joinedAt));
  return rows.map((r) => ({
    ...r,
    displayName: r.displayName || r.name || r.email.split("@")[0] || "player",
  }));
}

/** Paid, active (main|losers) entries with email/name (for emails). */
export async function getActiveEntries(seasonId: string) {
  const rows = await db
    .select({
      entryId: entries.id,
      bracket: entries.bracket,
      displayName: user.displayName,
      name: user.name,
      email: user.email,
    })
    .from(entries)
    .innerJoin(user, eq(entries.userId, user.id))
    // Reminders go to anyone who can still pick; payment is tracked separately
    // and no longer gates picking.
    .where(eq(entries.seasonId, seasonId));
  return rows
    .filter((r) => r.bracket === "main" || r.bracket === "losers")
    .map((r) => ({
      entryId: r.entryId,
      bracket: r.bracket,
      name: r.displayName || r.name || r.email.split("@")[0] || "player",
      email: r.email,
    }));
}
