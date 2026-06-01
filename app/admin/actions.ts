"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import { getCurrentSeason, getSeasonById } from "@/lib/queries/seasons";
import { db } from "@/lib/db";
import { seasons, entries } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import {
  syncAndGradeCurrentWeek,
  refreshLockAt,
  advanceWeek,
} from "@/lib/season-ops";
import type { SeasonStatus, SeasonPhase } from "@/lib/db/schema";

async function assertAdmin() {
  await requireAdmin(); // redirects non-admins
}

export async function createSeason(formData: FormData) {
  await assertAdmin();
  await db.insert(seasons).values({
    year: Number(formData.get("year")),
    status: "signup",
    phase: "regular",
    currentWeek: 1,
    buyIn: String(Number(formData.get("buy_in") || 0)),
    venmoHandle: String(formData.get("venmo_handle") || "") || null,
    venmoLink: String(formData.get("venmo_link") || "") || null,
  });
  revalidatePath("/admin");
}

export async function updateSeasonSettings(formData: FormData) {
  await assertAdmin();
  const id = String(formData.get("season_id"));
  await db
    .update(seasons)
    .set({
      buyIn: String(Number(formData.get("buy_in") || 0)),
      venmoHandle: String(formData.get("venmo_handle") || "") || null,
      venmoLink: String(formData.get("venmo_link") || "") || null,
    })
    .where(eq(seasons.id, id));
  revalidatePath("/admin");
}

export async function setStatus(seasonId: string, status: SeasonStatus) {
  await assertAdmin();
  await db.update(seasons).set({ status }).where(eq(seasons.id, seasonId));

  // When opening the season, compute the week-1 lock time from ESPN.
  if (status === "active") {
    const season = await getSeasonById(seasonId);
    if (season) await refreshLockAt(season);
  }
  revalidatePath("/admin");
  revalidatePath("/");
}

export async function setPhase(seasonId: string, phase: SeasonPhase) {
  await assertAdmin();
  await db.update(seasons).set({ phase }).where(eq(seasons.id, seasonId));
  revalidatePath("/admin");
}

export async function confirmPaid(entryId: string, paid: boolean) {
  await assertAdmin();
  await db.update(entries).set({ paid }).where(eq(entries.id, entryId));
  revalidatePath("/admin");
}

export async function syncAndGrade() {
  await assertAdmin();
  const season = await getCurrentSeason();
  if (!season) return;
  await syncAndGradeCurrentWeek(season);
  revalidatePath("/admin");
  revalidatePath("/");
}

export async function nextWeek() {
  await assertAdmin();
  const season = await getCurrentSeason();
  if (!season) return;
  await advanceWeek(season);
  revalidatePath("/admin");
  revalidatePath("/");
}

export async function refreshLock() {
  await assertAdmin();
  const season = await getCurrentSeason();
  if (!season) return;
  await refreshLockAt(season);
  revalidatePath("/admin");
  revalidatePath("/");
}

/**
 * Mark the season complete and freeze final ranks. Ranks: alive (main/losers)
 * first, then eliminated by latest elimination week (later out = better finish).
 */
export async function completeSeason() {
  await assertAdmin();
  const season = await getCurrentSeason();
  if (!season) return;

  const rows = await db
    .select({
      id: entries.id,
      bracket: entries.bracket,
      eliminatedWeek: entries.eliminatedWeek,
    })
    .from(entries)
    .where(and(eq(entries.seasonId, season.id), eq(entries.paid, true)));

  const ordered = rows.slice().sort((a, b) => {
    const tier = (x: { bracket: string }) =>
      x.bracket === "main" ? 0 : x.bracket === "losers" ? 1 : 2;
    if (tier(a) !== tier(b)) return tier(a) - tier(b);
    return (b.eliminatedWeek ?? 0) - (a.eliminatedWeek ?? 0);
  });
  for (let i = 0; i < ordered.length; i++) {
    await db
      .update(entries)
      .set({ finalRank: i + 1 })
      .where(eq(entries.id, ordered[i].id));
  }

  await db
    .update(seasons)
    .set({ status: "complete" })
    .where(eq(seasons.id, season.id));
  revalidatePath("/admin");
  revalidatePath("/");
}

export async function archiveSeason(seasonId: string) {
  await assertAdmin();
  await db
    .update(seasons)
    .set({ status: "archived" })
    .where(eq(seasons.id, seasonId));
  revalidatePath("/admin");
}
