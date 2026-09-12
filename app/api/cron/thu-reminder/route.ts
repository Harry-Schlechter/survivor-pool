// Called hourly by GitHub Actions (see .github/workflows/cron.yml). On the
// morning OF the day the week locks — whatever day that actually is (Thu most
// weeks, but Wed/Sat/Mon around holidays and the season opener) — reminds
// active players who haven't picked yet. Keying off the real lock date
// instead of a hardcoded weekday means this fires correctly for the
// Thanksgiving, Christmas and Wk1 games that don't lock Thursday. Deduped via
// the notifications table like lock-reminder.
//
// Replaces the Netlify Scheduled Function of the same name: that trigger
// silently stopped firing site-wide (see lib/cron/shared.ts for the story).

import { type NextRequest, NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/cron/auth";
import { getActiveSeason, getActiveEntries, nowET, heartbeat } from "@/lib/cron/shared";
import { db } from "@/lib/db";
import { picks, notifications } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { sendEachEmail } from "@/lib/email/send";
import { pickReminderEmail } from "@/lib/email/templates";

export async function POST(request: NextRequest) {
  const unauthorized = requireCronSecret(request);
  if (unauthorized) return unauthorized;

  const et = nowET();
  if (et.hour !== 9) {
    return NextResponse.json({ ok: true, note: "outside the 9am ET hour" });
  }

  const season = await getActiveSeason();
  if (!season || !season.lockAt) {
    return NextResponse.json({ ok: true, note: "no active season or no lock set" });
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
    return NextResponse.json({ ok: true, note: "not lock day" });
  }

  const active = await getActiveEntries(season.id);
  const pickRows = await db
    .select({ entryId: picks.entryId })
    .from(picks)
    .where(and(eq(picks.seasonId, season.id), eq(picks.week, season.currentWeek)));
  const picked = new Set(pickRows.map((p) => p.entryId));

  // Called hourly, so dedupe against notifications the same way lock-reminder
  // does — the guards above narrow it to one lock-day window, but a repeat
  // call inside that window must not re-send.
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

  return NextResponse.json({ ok: true, reminded: sent, failed: failed.length });
}
