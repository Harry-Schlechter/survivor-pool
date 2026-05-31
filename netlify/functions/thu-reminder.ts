// Thursday ~9am ET: remind active players who haven't picked the current week.

import type { Config } from "@netlify/functions";
import {
  adminClient,
  getActiveSeason,
  getActiveEntries,
  nowET,
} from "./_shared";
import { sendEmail } from "../../lib/email/send";
import { pickReminderEmail } from "../../lib/email/templates";

export default async function handler() {
  const et = nowET();
  if (et.weekday !== 4 || et.hour < 8 || et.hour > 11) {
    return new Response("outside ET window", { status: 200 });
  }

  const admin = adminClient();
  const season = await getActiveSeason(admin);
  if (!season) return new Response("no active season", { status: 200 });

  const entries = await getActiveEntries(admin, season.id);
  const { data: picks } = await admin
    .from("picks")
    .select("entry_id")
    .eq("season_id", season.id)
    .eq("week", season.current_week);
  const picked = new Set((picks ?? []).map((p) => p.entry_id));

  const unpicked = entries.filter((e) => !picked.has(e.entryId) && e.email);
  const { subject, html } = pickReminderEmail(season.current_week, false);

  for (const e of unpicked) {
    await sendEmail({ to: e.email, subject, html });
  }

  return Response.json({ ok: true, reminded: unpicked.length });
}

export const config: Config = {
  schedule: "0 13 * * 4",
};
