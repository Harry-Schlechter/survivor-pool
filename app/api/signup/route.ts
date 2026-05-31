import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Join the current signup-status season (creates an unpaid main-bracket entry).
export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: season } = await supabase
    .from("seasons")
    .select("id,status")
    .eq("status", "signup")
    .order("year", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!season) {
    return NextResponse.json({ error: "signups_closed" }, { status: 400 });
  }

  const { error } = await supabase.from("entries").insert({
    season_id: season.id,
    user_id: user.id,
    bracket: "main",
    paid: false,
  });
  // Unique violation = already joined; treat as success (idempotent).
  if (error && !error.message.includes("duplicate")) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
