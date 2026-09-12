// Shared helpers for the /api/cron/* routes.

import { getActiveSeason } from "@/lib/queries/seasons";
import { getActiveEntries } from "@/lib/queries/admin";
import { sendEmail } from "@/lib/email/send";

export { getActiveSeason, getActiveEntries };

/**
 * Heartbeat sent to the pool admin every time a cron route's logic actually
 * runs (not on an early-return no-op) — the way to confirm the external
 * scheduler is calling in at all. Netlify Scheduled Functions were replaced
 * by these routes because their trigger silently stopped firing on this
 * site: registration was correct and manual "Run now" worked, but zero
 * invocations occurred on schedule for 18+ days across two deploys (caught
 * via the notifications table staying empty and games.updated_at frozen).
 * If a heartbeat stops arriving here, GitHub Actions has stopped calling in
 * — check its Actions tab, which (unlike Netlify's scheduler) has readable
 * run history.
 *
 * Deliberately swallows its own failure: a heartbeat that throws must never
 * take down the job it's reporting on.
 */
export async function heartbeat(fn: string, detail: string): Promise<void> {
  try {
    await sendEmail({
      to: "harry.schlechter391@gmail.com",
      subject: `✓ ${fn} ran`,
      html: `<p>${fn} executed at ${new Date().toISOString()}.</p><p>${detail}</p>`,
    });
  } catch (err) {
    console.error(`heartbeat failed for ${fn}:`, err);
  }
}

/** Current hour/minute/weekday in America/New_York, DST-aware. */
export function nowET(): { hour: number; minute: number; weekday: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const weekdays: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    hour: Number(get("hour")) % 24,
    minute: Number(get("minute")),
    weekday: weekdays[get("weekday")] ?? -1,
  };
}
