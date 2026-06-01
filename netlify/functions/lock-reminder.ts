// Hourly: when the current week's lock is within ~75 min, send a one-time
// urgent reminder to active players who still haven't picked. Deduped via the
// notifications table (unique on season+week+kind+entry).

import type { Config } from "@netlify/functions";
import { getActiveSeason, getActivePaidEntries } from "./_shared";
import { db } from "../../lib/db";
import { picks, notifications } from "../../lib/db/schema";
import { and, eq } from "drizzle-orm";
import { sendEmail } from "../../lib/email/send";
import { pickReminderEmail } from "../../lib/email/templates";

const WINDOW_MS = 75 * 60 * 1000;

export default async function handler() {
  const season = await getActiveSeason();
  if (!season || !season.lockAt) {
    return new Response("no lock", { status: 200 });
  }

  const msToLock = new Date(season.lockAt).getTime() - Date.now();
  if (msToLock <= 0 || msToLock > WINDOW_MS) {
    return new Response("not in lock window", { status: 200 });
  }

  const active = await getActivePaidEntries(season.id);

  const pickRows = await db
    .select({ entryId: picks.entryId })
    .from(picks)
    .where(and(eq(picks.seasonId, season.id), eq(picks.week, season.currentWeek)));
  const picked = new Set(pickRows.map((p) => p.entryId));

  const sentRows = await db
    .select({ entryId: notifications.entryId })
    .from(notifications)
    .where(
      and(
        eq(notifications.seasonId, season.id),
        eq(notifications.week, season.currentWeek),
        eq(notifications.kind, "lock_reminder"),
      ),
    );
  const alreadySent = new Set(sentRows.map((n) => n.entryId));

  const targets = active.filter(
    (e) => !picked.has(e.entryId) && !alreadySent.has(e.entryId) && e.email,
  );
  const { subject, html } = pickReminderEmail(season.currentWeek, true);

  let count = 0;
  for (const e of targets) {
    await sendEmail({ to: e.email, subject, html });
    await db.insert(notifications).values({
      seasonId: season.id,
      week: season.currentWeek,
      kind: "lock_reminder",
      entryId: e.entryId,
    });
    count++;
  }

  return Response.json({ ok: true, reminded: count });
}

export const config: Config = {
  schedule: "0 * * * *",
};
