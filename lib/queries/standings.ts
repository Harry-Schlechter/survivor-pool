// Standings for the dashboard. Replaces the Supabase RLS-governed read: the
// post-lock pick-visibility rule (you always see your own pick; everyone else's
// only after lock) is enforced HERE in application code, since Neon has no RLS.

import { db } from "@/lib/db";
import { entries, picks, user } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import type { Bracket } from "@/lib/db/schema";

export interface StandingRow {
  entryId: string;
  userId: string;
  displayName: string;
  bracket: Bracket;
  eliminatedWeek: number | null;
  hasPick: boolean; // whether they've picked this week (shown pre-lock)
  thisWeekPick: string | null; // team_abbr, or null if none / hidden pre-lock
  thisWeekResult: "pending" | "win" | "loss" | null;
}

export interface Standings {
  main: StandingRow[];
  losers: StandingRow[];
  eliminated: StandingRow[];
  locked: boolean;
}

export async function getStandings(
  seasonId: string,
  week: number,
  lockAt: Date | null,
  viewerUserId: string,
): Promise<Standings> {
  const locked = !!lockAt && new Date() >= new Date(lockAt);

  const entryRows = await db
    .select({
      entryId: entries.id,
      userId: entries.userId,
      bracket: entries.bracket,
      eliminatedWeek: entries.eliminatedWeek,
      displayName: user.displayName,
      name: user.name,
      email: user.email,
    })
    .from(entries)
    .innerJoin(user, eq(entries.userId, user.id))
    // Not filtered on paid: players may pick before their buy-in is confirmed,
    // so a paid-only standings list would hide them from the pool (and from
    // themselves) even though their pick counts.
    .where(eq(entries.seasonId, seasonId));

  const pickRows = await db
    .select({
      entryId: picks.entryId,
      teamAbbr: picks.teamAbbr,
      result: picks.result,
    })
    .from(picks)
    .where(and(eq(picks.seasonId, seasonId), eq(picks.week, week)));

  const pickByEntry = new Map(pickRows.map((p) => [p.entryId, p]));

  const rows: StandingRow[] = entryRows.map((e) => {
    const pick = pickByEntry.get(e.entryId);
    const isOwn = e.userId === viewerUserId;
    const visible = isOwn || locked; // others' picks only after lock
    return {
      entryId: e.entryId,
      userId: e.userId,
      displayName: e.displayName || e.name || e.email.split("@")[0] || "player",
      bracket: e.bracket as Bracket,
      eliminatedWeek: e.eliminatedWeek,
      hasPick: pickByEntry.has(e.entryId),
      thisWeekPick: visible ? (pick?.teamAbbr ?? null) : null,
      thisWeekResult: visible
        ? ((pick?.result as StandingRow["thisWeekResult"]) ?? null)
        : null,
    };
  });

  const byName = (a: StandingRow, b: StandingRow) =>
    a.displayName.localeCompare(b.displayName);

  return {
    main: rows.filter((r) => r.bracket === "main").sort(byName),
    losers: rows.filter((r) => r.bracket === "losers").sort(byName),
    eliminated: rows
      .filter((r) => r.bracket === "eliminated")
      .sort((a, b) => (a.eliminatedWeek ?? 0) - (b.eliminatedWeek ?? 0)),
    locked,
  };
}
