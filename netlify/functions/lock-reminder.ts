// Hourly: when the current week's lock is within ~75 min, send a one-time
// urgent reminder to active players who still haven't picked. Deduped via the
// notifications table (unique on season+week+kind+entry).

import type { Config } from "@netlify/functions";
import { adminClient, getActiveSeason, getActiveEntries } from "./_shared";
import { sendEmail } from "../../lib/email/send";
import { pickReminderEmail } from "../../lib/email/templates";

const WINDOW_MS = 75 * 60 * 1000;

export default async function handler() {
  const admin = adminClient();
  const season = await getActiveSeason(admin);
  if (!season || !season.lock_at) {
    return new Response("no lock", { status: 200 });
  }

  const msToLock = new Date(season.lock_at).getTime() - Date.now();
  if (msToLock <= 0 || msToLock > WINDOW_MS) {
    return new Response("not in lock window", { status: 200 });
  }

  const entries = await getActiveEntries(admin, season.id);
  const { data: picks } = await admin
    .from("picks")
    .select("entry_id")
    .eq("season_id", season.id)
    .eq("week", season.current_week);
  const picked = new Set((picks ?? []).map((p) => p.entry_id));

  // Already-reminded entries (dedupe).
  const { data: sent } = await admin
    .from("notifications")
    .select("entry_id")
    .eq("season_id", season.id)
    .eq("week", season.current_week)
    .eq("kind", "lock_reminder");
  const alreadySent = new Set((sent ?? []).map((n) => n.entry_id));

  const targets = entries.filter(
    (e) => !picked.has(e.entryId) && !alreadySent.has(e.entryId) && e.email,
  );
  const { subject, html } = pickReminderEmail(season.current_week, true);

  let count = 0;
  for (const e of targets) {
    await sendEmail({ to: e.email, subject, html });
    await admin.from("notifications").insert({
      season_id: season.id,
      week: season.current_week,
      kind: "lock_reminder",
      entry_id: e.entryId,
    });
    count++;
  }

  return Response.json({ ok: true, reminded: count });
}

export const config: Config = {
  schedule: "0 * * * *",
};
