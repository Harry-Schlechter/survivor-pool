// Thursday ~9am ET: remind active players who haven't picked the current week.

import type { Config } from "@netlify/functions";
import { getActiveSeason, getActivePaidEntries, nowET } from "./_shared";
import { db } from "../../lib/db";
import { picks } from "../../lib/db/schema";
import { and, eq } from "drizzle-orm";
import { sendEachEmail } from "../../lib/email/send";
import { pickReminderEmail } from "../../lib/email/templates";

export default async function handler() {
  const et = nowET();
  if (et.weekday !== 4 || et.hour !== 9) {
    return new Response("outside Thu 9am ET window", { status: 200 });
  }

  const season = await getActiveSeason();
  if (!season) return new Response("no active season", { status: 200 });

  const active = await getActivePaidEntries(season.id);
  const pickRows = await db
    .select({ entryId: picks.entryId })
    .from(picks)
    .where(and(eq(picks.seasonId, season.id), eq(picks.week, season.currentWeek)));
  const picked = new Set(pickRows.map((p) => p.entryId));

  const unpicked = active.filter((e) => !picked.has(e.entryId) && e.email);
  const { subject, html } = pickReminderEmail(season.currentWeek, false);
  const { sent, failed } = await sendEachEmail(
    unpicked.map((e) => e.email),
    subject,
    html,
  );

  return Response.json({ ok: true, reminded: sent, failed: failed.length });
}

export const config: Config = {
  schedule: "0 13 * * 4",
};
