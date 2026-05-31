// Shared helpers for scheduled functions. These run in the Netlify Functions
// runtime (Node), separate from Next.js, and use the service-role key directly
// from process.env (set in Netlify env vars).

import { createClient } from "@supabase/supabase-js";
import type { Database, SeasonRow } from "../../lib/database.types";

export function adminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

/** Current hour/minute/weekday in America/New_York, DST-aware. */
export function nowET(): { hour: number; minute: number; weekday: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const weekdays: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    hour: Number(get("hour")) % 24,
    minute: Number(get("minute")),
    weekday: weekdays[get("weekday")] ?? -1,
  };
}

export async function getActiveSeason(
  admin: ReturnType<typeof adminClient>,
): Promise<SeasonRow | null> {
  const { data } = await admin
    .from("seasons")
    .select("*")
    .eq("status", "active")
    .order("year", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

/** Paid, active (main|losers) entries with the player's email + name. */
export async function getActiveEntries(
  admin: ReturnType<typeof adminClient>,
  seasonId: string,
) {
  const { data } = await admin
    .from("entries")
    .select("id,bracket,profiles(display_name,email)")
    .eq("season_id", seasonId)
    .eq("paid", true)
    .in("bracket", ["main", "losers"]);
  return (data ?? []).map((e) => {
    const prof = Array.isArray(e.profiles) ? e.profiles[0] : e.profiles;
    return {
      entryId: e.id,
      bracket: e.bracket,
      name: prof?.display_name ?? "player",
      email: prof?.email ?? "",
    };
  });
}
