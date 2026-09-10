// Shared helpers for scheduled functions. These run in the Netlify Functions
// runtime (Node) and reuse the same Drizzle query layer as the app.

import { getActiveSeason } from "../../lib/queries/seasons";
import { getActiveEntries } from "../../lib/queries/admin";
import { sendEmail } from "../../lib/email/send";

export { getActiveSeason, getActiveEntries };

/**
 * Heartbeat sent to the pool admin every time a scheduled function actually
 * runs its logic (not on an early-return no-op) — the ONLY way we have to
 * confirm Netlify invoked it at all, after lock-reminder's cron produced zero
 * log output for 24 hours straight on 2026-09-09 despite a correctly
 * registered hourly schedule. If a heartbeat stops arriving, the trigger
 * itself has silently stopped firing again — that's a Netlify-side problem,
 * not a code bug, and this is how we'd know before the next lock rather than
 * after it.
 *
 * Deliberately swallows its own failure: a heartbeat that throws must never
 * take down the reminder/summary logic it's reporting on.
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
