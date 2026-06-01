import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/guards";
import { getSignupSeason, getEntry } from "@/lib/queries/seasons";
import { db } from "@/lib/db";
import { entries } from "@/lib/db/schema";

// Join the current signup-status season (creates an unpaid main-bracket entry).
export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const season = await getSignupSeason();
  if (!season) {
    return NextResponse.json({ error: "signups_closed" }, { status: 400 });
  }

  // Idempotent: skip if already joined.
  const existing = await getEntry(season.id, user.id);
  if (existing) return NextResponse.json({ ok: true });

  await db.insert(entries).values({
    seasonId: season.id,
    userId: user.id,
    bracket: "main",
    paid: false,
  });
  return NextResponse.json({ ok: true });
}
