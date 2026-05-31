// Tuesday ~9am ET: email everyone the prior week's recap. The cron fires at
// 13:00 UTC; we verify the ET window so DST doesn't shift it off Tuesday-AM.

import type { Config } from "@netlify/functions";
import {
  adminClient,
  getActiveSeason,
  getActiveEntries,
  nowET,
} from "./_shared";
import { sendEmail } from "../../lib/email/send";
import { weekSummaryEmail } from "../../lib/email/templates";

export default async function handler() {
  const et = nowET();
  // Tuesday, 8-11am ET window guard.
  if (et.weekday !== 2 || et.hour < 8 || et.hour > 11) {
    return new Response("outside ET window", { status: 200 });
  }

  const admin = adminClient();
  const season = await getActiveSeason(admin);
  if (!season) return new Response("no active season", { status: 200 });

  // The week that just completed is current_week - 1 (admin advances Mon/Tue),
  // but if they haven't advanced yet, summarize current_week.
  const summaryWeek = season.current_week;

  const entries = await getActiveEntries(admin, season.id);

  // Who got eliminated in the summary week.
  const { data: elimEntries } = await admin
    .from("entries")
    .select("id,bracket,eliminated_week,profiles(display_name)")
    .eq("season_id", season.id)
    .eq("eliminated_week", summaryWeek);

  const { data: picks } = await admin
    .from("picks")
    .select("entry_id,team_abbr")
    .eq("season_id", season.id)
    .eq("week", summaryWeek);
  const pickByEntry = new Map((picks ?? []).map((p) => [p.entry_id, p.team_abbr]));

  const eliminated = (elimEntries ?? []).map((e) => {
    const prof = Array.isArray(e.profiles) ? e.profiles[0] : e.profiles;
    return {
      name: prof?.display_name ?? "player",
      pick: pickByEntry.get(e.id) ?? null,
    };
  });

  const { subject, html } = weekSummaryEmail({
    year: season.year,
    week: summaryWeek,
    eliminated,
    mainAlive: entries.filter((e) => e.bracket === "main").map((e) => e.name),
    losersAlive: entries.filter((e) => e.bracket === "losers").map((e) => e.name),
    nextWeek: summaryWeek + 1,
  });

  const recipients = entries.map((e) => e.email).filter(Boolean);
  if (recipients.length > 0) {
    await sendEmail({ to: recipients, subject, html });
  }

  await admin.from("notifications").insert({
    season_id: season.id,
    week: summaryWeek,
    kind: "tue_summary",
  });

  return Response.json({ ok: true, recipients: recipients.length });
}

export const config: Config = {
  schedule: "0 13 * * 2",
};
