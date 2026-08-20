// Tuesday ~9am ET: email everyone the recap of the week that just finished.
// This runs AFTER the 3am-ET weekly-rollover, which already graded that week
// and advanced current_week — so the completed week is current_week - 1.
// Cron fires at 13:00 + 14:00 UTC (covers EST + EDT); the exact-9am-ET guard
// makes the handler execute only once.

import type { Config } from "@netlify/functions";
import { getActiveSeason, getActivePaidEntries, nowET } from "./_shared";
import { db } from "../../lib/db";
import { entries, picks, user } from "../../lib/db/schema";
import { and, eq } from "drizzle-orm";
import { sendEachEmail } from "../../lib/email/send";
import { weekSummaryEmail } from "../../lib/email/templates";

export default async function handler() {
  const et = nowET();
  if (et.weekday !== 2 || et.hour !== 9) {
    return new Response("outside Tue 9am ET window", { status: 200 });
  }

  const season = await getActiveSeason();
  if (!season) return new Response("no active season", { status: 200 });

  // The rollover already advanced the week, so the just-completed week is the
  // one before current_week (floor at 1 for safety).
  const summaryWeek = Math.max(1, season.currentWeek - 1);
  const active = await getActivePaidEntries(season.id);

  const elimRows = await db
    .select({
      id: entries.id,
      displayName: user.displayName,
      name: user.name,
      email: user.email,
    })
    .from(entries)
    .innerJoin(user, eq(entries.userId, user.id))
    .where(
      and(
        eq(entries.seasonId, season.id),
        eq(entries.eliminatedWeek, summaryWeek),
      ),
    );

  const pickRows = await db
    .select({ entryId: picks.entryId, teamAbbr: picks.teamAbbr })
    .from(picks)
    .where(and(eq(picks.seasonId, season.id), eq(picks.week, summaryWeek)));
  const pickByEntry = new Map(pickRows.map((p) => [p.entryId, p.teamAbbr]));

  const eliminated = elimRows.map((e) => ({
    name: e.displayName || e.name || e.email.split("@")[0] || "player",
    pick: pickByEntry.get(e.id) ?? null,
  }));

  const { subject, html } = weekSummaryEmail({
    year: season.year,
    week: summaryWeek,
    eliminated,
    mainAlive: active.filter((e) => e.bracket === "main").map((e) => e.name),
    losersAlive: active.filter((e) => e.bracket === "losers").map((e) => e.name),
    nextWeek: summaryWeek + 1,
  });

  // Send individually rather than one message with everyone in `to:` — a shared
  // to-list would expose every player's address to the whole pool, and a single
  // bad address would fail the entire recap.
  const recipients = active.map((e) => e.email).filter(Boolean);
  const { sent, failed } = await sendEachEmail(recipients, subject, html);

  return Response.json({ ok: true, sent, failed: failed.length });
}

export const config: Config = {
  schedule: "0 13 * * 2",
};
