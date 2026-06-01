// Tuesday ~9am ET: email everyone the prior week's recap. Cron fires 13:00 UTC;
// the ET-window guard keeps it on Tuesday morning across DST.

import type { Config } from "@netlify/functions";
import { getActiveSeason, getActivePaidEntries, nowET } from "./_shared";
import { db } from "../../lib/db";
import { entries, picks, user } from "../../lib/db/schema";
import { and, eq } from "drizzle-orm";
import { sendEmail } from "../../lib/email/send";
import { weekSummaryEmail } from "../../lib/email/templates";

export default async function handler() {
  const et = nowET();
  if (et.weekday !== 2 || et.hour < 8 || et.hour > 11) {
    return new Response("outside ET window", { status: 200 });
  }

  const season = await getActiveSeason();
  if (!season) return new Response("no active season", { status: 200 });

  const summaryWeek = season.currentWeek;
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

  const recipients = active.map((e) => e.email).filter(Boolean);
  if (recipients.length > 0) await sendEmail({ to: recipients, subject, html });

  return Response.json({ ok: true, recipients: recipients.length });
}

export const config: Config = {
  schedule: "0 13 * * 2",
};
