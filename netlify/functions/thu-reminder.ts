// Runs hourly, 8-10am ET: on the morning OF the day the week locks — whatever
// day that actually is (Thu most weeks, but Wed/Sat/Mon around holidays and
// the season opener) — remind active players who haven't picked yet. Keying
// off the real lock date instead of a hardcoded weekday means this fires
// correctly for the Thanksgiving, Christmas and Wk1 games that don't lock
// Thursday. Deduped via the notifications table like lock-reminder.

import type { Config } from "@netlify/functions";
import { getActiveSeason, getActiveEntries, nowET, heartbeat } from "./_shared";
import { db } from "../../lib/db";
import { picks, notifications } from "../../lib/db/schema";
import { and, eq } from "drizzle-orm";
import { sendEachEmail } from "../../lib/email/send";
import { pickReminderEmail } from "../../lib/email/templates";

export default async function handler() {
  const et = nowET();
  if (et.hour !== 9) {
    return new Response("outside the 9am ET hour", { status: 200 });
  }

  const season = await getActiveSeason();
  if (!season || !season.lockAt) {
    return new Response("no active season or no lock set", { status: 200 });
  }

  // Fire only on the calendar day the lock actually falls on, in ET — not
  // "Thursday". lock-reminder still covers the final push in the last 2h
  // before kickoff regardless of which day that is.
  const lockDateET = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(season.lockAt));
  const todayDateET = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  if (lockDateET !== todayDateET) {
    return new Response("not lock day", { status: 200 });
  }

  const active = await getActiveEntries(season.id);
  const pickRows = await db
    .select({ entryId: picks.entryId })
    .from(picks)
    .where(and(eq(picks.seasonId, season.id), eq(picks.week, season.currentWeek)));
  const picked = new Set(pickRows.map((p) => p.entryId));

  // Cron now runs hourly and self-selects on lock day + the 9am ET hour rather
  // than one fixed UTC tick, so a DST-boundary week could otherwise fire this
  // twice. Dedupe against notifications the same way lock-reminder does.
  const sentRows = await db
    .select({ entryId: notifications.entryId })
    .from(notifications)
    .where(
      and(
        eq(notifications.seasonId, season.id),
        eq(notifications.week, season.currentWeek),
        eq(notifications.kind, "thu_reminder"),
      ),
    );
  const alreadySent = new Set(sentRows.map((n) => n.entryId));

  const targets = active.filter(
    (e) => !picked.has(e.entryId) && !alreadySent.has(e.entryId) && e.email,
  );
  const { subject, html } = pickReminderEmail(season.currentWeek, false);

  const entryByEmail = new Map(targets.map((e) => [e.email, e.entryId]));
  const { sent, failed } = await sendEachEmail(
    targets.map((e) => e.email),
    subject,
    html,
    async (email) => {
      await db.insert(notifications).values({
        seasonId: season.id,
        week: season.currentWeek,
        kind: "thu_reminder",
        entryId: entryByEmail.get(email)!,
      });
    },
  );

  await heartbeat(
    "thu-reminder",
    `Week ${season.currentWeek}, lock day. Reminded ${sent}, failed ${failed.length}.`,
  );

  return Response.json({ ok: true, reminded: sent, failed: failed.length });
}

export const config: Config = {
  // Hourly: the handler itself decides whether today is lock day and whether
  // it's the 9am ET hour (13:00 UTC EST / 14:00 UTC EDT would miss the day
  // check around DST transitions, so run every hour and let the guards filter).
  schedule: "0 * * * *",
};
