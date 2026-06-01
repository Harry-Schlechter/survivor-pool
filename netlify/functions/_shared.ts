// Shared helpers for scheduled functions. These run in the Netlify Functions
// runtime (Node) and reuse the same Drizzle query layer as the app.

import { getActiveSeason } from "../../lib/queries/seasons";
import { getActivePaidEntries } from "../../lib/queries/admin";

export { getActiveSeason, getActivePaidEntries };

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
