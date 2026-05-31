// Server-side helpers for loading the current user, their profile, and the
// active season. Used by RSC pages and route handlers.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ProfileRow, SeasonRow, EntryRow } from "@/lib/database.types";

export async function getSessionUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Require a signed-in user or redirect to login. Returns {user, profile}. */
export async function requireUser(): Promise<{
  user: { id: string; email?: string };
  profile: ProfileRow;
}> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Ensure a profile row exists (idempotent upsert from the auth identity).
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    const { data: created } = await supabase
      .from("profiles")
      .upsert(
        {
          id: user.id,
          email: user.email ?? "",
          display_name: user.email?.split("@")[0] ?? "player",
        },
        { onConflict: "id" },
      )
      .select("*")
      .single();
    return { user, profile: created as ProfileRow };
  }

  return { user, profile };
}

export async function requireAdmin(): Promise<ProfileRow> {
  const { profile } = await requireUser();
  if (!profile.is_admin) redirect("/");
  return profile;
}

/** The current non-archived season (signup/active/complete), if any. */
export async function getCurrentSeason(): Promise<SeasonRow | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("seasons")
    .select("*")
    .neq("status", "archived")
    .order("year", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

export async function getMyEntry(
  seasonId: string,
  userId: string,
): Promise<EntryRow | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("entries")
    .select("*")
    .eq("season_id", seasonId)
    .eq("user_id", userId)
    .maybeSingle();
  return data ?? null;
}
