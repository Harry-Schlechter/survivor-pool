// Pick validation rules — pure functions so they're trivially testable and can
// be reused by both the client UI (to disable options) and the server route
// (authoritative re-check). The DB RLS policies are the final hard gate.

import type { SeasonPhase, PickBracket } from "@/lib/db/schema";

// Season-long cap, regular season only. Usage is NOT reset by dropping into
// the losers bracket — a team burned twice in the winners pool stays spent.
export const MAX_TEAM_USES = 2;

export interface WeekGameLite {
  homeAbbr: string;
  awayAbbr: string;
}

export interface ValidatePickInput {
  teamAbbr: string;
  bracket: PickBracket;
  phase: SeasonPhase;
  lockAt: string | null; // ISO; null = not yet set (treat as open)
  now: Date;
  weekGames: WeekGameLite[];
  /** This entry's prior picks across the WHOLE season, both brackets. */
  priorTeamAbbrsThisSeason: string[];
  entryPaid: boolean;
  entryActive: boolean; // bracket is 'main' or 'losers' (not 'eliminated')
}

export type PickError =
  | "not_paid"
  | "not_active"
  | "locked"
  | "team_not_in_week"
  | "team_used_max";

export interface ValidationResult {
  ok: boolean;
  error?: PickError;
}

function teamPlaysThisWeek(team: string, games: WeekGameLite[]): boolean {
  return games.some((g) => g.homeAbbr === team || g.awayAbbr === team);
}

/** Count of how many times a team may still be used (UI helper). */
export function remainingUses(
  teamAbbr: string,
  phase: SeasonPhase,
  priorTeamAbbrsThisSeason: string[],
): number {
  if (phase === "playoffs") return Infinity; // cap lifted in playoffs
  const used = priorTeamAbbrsThisSeason.filter((t) => t === teamAbbr).length;
  return Math.max(0, MAX_TEAM_USES - used);
}

export function validatePick(input: ValidatePickInput): ValidationResult {
  if (!input.entryPaid) return { ok: false, error: "not_paid" };
  if (!input.entryActive) return { ok: false, error: "not_active" };

  if (input.lockAt && input.now >= new Date(input.lockAt)) {
    return { ok: false, error: "locked" };
  }

  if (!teamPlaysThisWeek(input.teamAbbr, input.weekGames)) {
    return { ok: false, error: "team_not_in_week" };
  }

  if (input.phase === "regular") {
    const used = input.priorTeamAbbrsThisSeason.filter(
      (t) => t === input.teamAbbr,
    ).length;
    if (used >= MAX_TEAM_USES) {
      return { ok: false, error: "team_used_max" };
    }
  }

  return { ok: true };
}
