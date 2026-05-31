import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Player self-reports they've Venmo'd. Sets paid_marked_by_user; admin confirms
// the real `paid` flag separately.
export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: season } = await supabase
    .from("seasons")
    .select("id")
    .neq("status", "archived")
    .order("year", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!season) return NextResponse.json({ error: "no_season" }, { status: 400 });

  const { error } = await supabase
    .from("entries")
    .update({ paid_marked_by_user: true })
    .eq("season_id", season.id)
    .eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
