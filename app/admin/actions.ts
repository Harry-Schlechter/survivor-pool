"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, getCurrentSeason } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  syncAndGradeCurrentWeek,
  refreshLockAt,
  advanceWeek,
} from "@/lib/season-ops";
import { computePayouts } from "@/lib/payouts";
import type { SeasonStatus, SeasonPhase } from "@/lib/database.types";

// Every action re-checks admin via the RLS-governed session client, then uses
// the service-role client for the privileged mutation.

async function assertAdmin() {
  await requireAdmin(); // redirects non-admins
}

export async function createSeason(formData: FormData) {
  await assertAdmin();
  const admin = createAdminClient();
  const year = Number(formData.get("year"));
  const buyIn = Number(formData.get("buy_in") || 0);
  const venmoHandle = String(formData.get("venmo_handle") || "");
  const venmoLink = String(formData.get("venmo_link") || "");

  await admin.from("seasons").insert({
    year,
    status: "signup",
    phase: "regular",
    current_week: 1,
    buy_in: buyIn,
    venmo_handle: venmoHandle || null,
    venmo_link: venmoLink || null,
  });
  revalidatePath("/admin");
}

export async function updateSeasonSettings(formData: FormData) {
  await assertAdmin();
  const admin = createAdminClient();
  const id = String(formData.get("season_id"));
  await admin
    .from("seasons")
    .update({
      buy_in: Number(formData.get("buy_in") || 0),
      venmo_handle: String(formData.get("venmo_handle") || "") || null,
      venmo_link: String(formData.get("venmo_link") || "") || null,
    })
    .eq("id", id);
  revalidatePath("/admin");
}

export async function setStatus(seasonId: string, status: SeasonStatus) {
  await assertAdmin();
  const admin = createAdminClient();
  await admin
    .from("seasons")
    .update({ status })
    .eq("id", seasonId);

  // When opening the season, compute the week-1 lock time from ESPN.
  if (status === "active") {
    const { data: season } = await admin
      .from("seasons")
      .select("*")
      .eq("id", seasonId)
      .single();
    if (season) await refreshLockAt(admin, season);
  }
  revalidatePath("/admin");
  revalidatePath("/");
}

export async function setPhase(seasonId: string, phase: SeasonPhase) {
  await assertAdmin();
  const admin = createAdminClient();
  await admin.from("seasons").update({ phase }).eq("id", seasonId);
  revalidatePath("/admin");
}

export async function confirmPaid(entryId: string, paid: boolean) {
  await assertAdmin();
  const admin = createAdminClient();
  await admin.from("entries").update({ paid }).eq("id", entryId);
  revalidatePath("/admin");
}

export async function syncAndGrade() {
  await assertAdmin();
  const admin = createAdminClient();
  const season = await getCurrentSeason();
  if (!season) return;
  await syncAndGradeCurrentWeek(admin, season);
  revalidatePath("/admin");
  revalidatePath("/");
}

export async function nextWeek() {
  await assertAdmin();
  const admin = createAdminClient();
  const season = await getCurrentSeason();
  if (!season) return;
  await advanceWeek(admin, season);
  revalidatePath("/admin");
  revalidatePath("/");
}

export async function refreshLock() {
  await assertAdmin();
  const admin = createAdminClient();
  const season = await getCurrentSeason();
  if (!season) return;
  await refreshLockAt(admin, season);
  revalidatePath("/admin");
  revalidatePath("/");
}

/**
 * Mark the season complete and freeze final ranks + payout result. Ranks: the
 * sole survivor in each bracket is rank 1; eliminated players rank by how late
 * they went out (later elimination = better finish).
 */
export async function completeSeason() {
  await assertAdmin();
  const admin = createAdminClient();
  const season = await getCurrentSeason();
  if (!season) return;

  const { data: entries } = await admin
    .from("entries")
    .select("id,bracket,eliminated_week")
    .eq("season_id", season.id)
    .eq("paid", true);

  // Rank: alive (main/losers) first, then eliminated by latest elim week.
  const ordered = (entries ?? []).slice().sort((a, b) => {
    const alive = (x: { bracket: string }) =>
      x.bracket === "main" ? 0 : x.bracket === "losers" ? 1 : 2;
    if (alive(a) !== alive(b)) return alive(a) - alive(b);
    return (b.eliminated_week ?? 0) - (a.eliminated_week ?? 0);
  });
  for (let i = 0; i < ordered.length; i++) {
    await admin
      .from("entries")
      .update({ final_rank: i + 1 })
      .eq("id", ordered[i].id);
  }

  await admin
    .from("seasons")
    .update({ status: "complete" })
    .eq("id", season.id);
  revalidatePath("/admin");
  revalidatePath("/");
}

export async function archiveSeason(seasonId: string) {
  await assertAdmin();
  const admin = createAdminClient();
  await admin
    .from("seasons")
    .update({ status: "archived" })
    .eq("id", seasonId);
  revalidatePath("/admin");
}

// Exposed for a future payout-preview button; computePayouts is pure.
export { computePayouts };
