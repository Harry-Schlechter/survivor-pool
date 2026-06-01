import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/guards";
import { getCurrentSeason } from "@/lib/queries/seasons";
import { db } from "@/lib/db";
import { entries } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

// Player self-reports they've Venmo'd. Sets paid_marked_by_user; admin confirms
// the real `paid` flag separately.
export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const season = await getCurrentSeason();
  if (!season) return NextResponse.json({ error: "no_season" }, { status: 400 });

  await db
    .update(entries)
    .set({ paidMarkedByUser: true })
    .where(and(eq(entries.seasonId, season.id), eq(entries.userId, user.id)));

  return NextResponse.json({ ok: true });
}
