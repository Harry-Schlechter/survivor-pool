// Called hourly by GitHub Actions (see .github/workflows/cron.yml). When the
// current week's lock is within ~2 hours, sends a one-time urgent reminder to
// active players who still haven't picked. Deduped via the notifications
// table (unique on season+week+kind+entry) — safe to call more often than it
// needs to actually send.
//
// Replaces the Netlify Scheduled Function of the same name: that trigger
// silently stopped firing site-wide (see lib/cron/shared.ts for the story).

import { type NextRequest, NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/cron/auth";
import { getActiveSeason, getActiveEntries, heartbeat } from "@/lib/cron/shared";
import { db } from "@/lib/db";
import { picks, notifications } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { sendEachEmail } from "@/lib/email/send";
import { pickReminderEmail } from "@/lib/email/templates";

const WINDOW_MS = 2 * 60 * 60 * 1000;

export async function POST(request: NextRequest) {
  const unauthorized = requireCronSecret(request);
  if (unauthorized) return unauthorized;

  const season = await getActiveSeason();
  if (!season || !season.lockAt) {
    return NextResponse.json({ ok: true, note: "no lock" });
  }

  const msToLock = new Date(season.lockAt).getTime() - Date.now();
  if (msToLock <= 0 || msToLock > WINDOW_MS) {
    return NextResponse.json({ ok: true, note: "not in lock window" });
  }

  const active = await getActiveEntries(season.id);

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

  const entryByEmail = new Map(targets.map((e) => [e.email, e.entryId]));
  const { sent, failed } = await sendEachEmail(
    targets.map((e) => e.email),
    subject,
    html,
    // Record the dedupe row only after a confirmed send. A failed send stays
    // un-recorded so the next hourly call retries it while there's still time.
    async (email) => {
      await db.insert(notifications).values({
        seasonId: season.id,
        week: season.currentWeek,
        kind: "lock_reminder",
        entryId: entryByEmail.get(email)!,
      });
    },
  );

  await heartbeat(
    "lock-reminder",
    `Week ${season.currentWeek}, ${msToLock}ms to lock. Reminded ${sent}, failed ${failed.length}.`,
  );

  return NextResponse.json({ ok: true, reminded: sent, failed: failed.length });
}
