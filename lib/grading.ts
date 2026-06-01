// Weekly grading engine.
//
// Rules (locked in with the user):
//   - Pick a team to WIN. Correct => survive. Wrong OR tie => loss.
//   - Missing a pick by lock => automatic loss that week.
//   - A loss in the MAIN bracket drops you to the LOSERS bracket (first life lost).
//   - A loss in the LOSERS bracket eliminates you entirely.
//   - eliminated_week is stamped when a main-bracket player first loses
//     (i.e. when they leave the main pool). It is NOT overwritten later.
//
// `gradeWeek` is a PURE function over plain rows so it is fully unit-testable and
// idempotent: feeding it already-graded state produces the same transitions.

import type { Bracket } from "./db/schema";

export interface GradeEntry {
  id: string;
  bracket: Bracket; // current bracket BEFORE this week is applied
  eliminated_week: number | null;
}

export interface GradePick {
  entry_id: string;
  team_abbr: string;
  bracket: "main" | "losers"; // which pool this pick counts in
}

export interface GameResult {
  /** winner team abbr; null means tie or not-final. */
  winnerAbbr: string | null;
  completed: boolean;
}

export interface GradeInput {
  week: number;
  entries: GradeEntry[];
  picks: GradePick[];
  /** Map of team_abbr -> the game result involving that team. */
  resultsByTeam: Record<string, GameResult>;
}

export interface EntryUpdate {
  id: string;
  bracket: Bracket;
  eliminated_week: number | null;
}

export interface PickUpdate {
  entry_id: string;
  result: "win" | "loss";
}

export interface GradeOutput {
  entryUpdates: EntryUpdate[];
  pickUpdates: PickUpdate[];
  /** True if every active entry's relevant game is final (safe to finalize week). */
  allFinal: boolean;
}

/**
 * Determine the outcome of a single pick.
 * Returns 'win' | 'loss' | 'pending' (game not final yet).
 */
function pickOutcome(
  pick: GradePick | undefined,
  resultsByTeam: Record<string, GameResult>,
): "win" | "loss" | "pending" {
  // No pick submitted => automatic loss (only decided once we're grading; the
  // caller treats a missing pick for an active entry as a loss immediately
  // since there's nothing to wait on).
  if (!pick) return "loss";

  const game = resultsByTeam[pick.team_abbr];
  if (!game || !game.completed) return "pending";

  // Tie (winnerAbbr null on a completed game) or picked the loser => loss.
  return game.winnerAbbr === pick.team_abbr ? "win" : "loss";
}

export function gradeWeek(input: GradeInput): GradeOutput {
  const { week, entries, picks, resultsByTeam } = input;
  const picksByEntry = new Map<string, GradePick>();
  for (const p of picks) picksByEntry.set(p.entry_id, p);

  const entryUpdates: EntryUpdate[] = [];
  const pickUpdates: PickUpdate[] = [];
  let allFinal = true;

  for (const entry of entries) {
    // Only active entries play; eliminated entries are terminal.
    if (entry.bracket === "eliminated") continue;

    const pick = picksByEntry.get(entry.id);

    // A submitted pick on an unfinished game means the week isn't done.
    if (pick) {
      const game = resultsByTeam[pick.team_abbr];
      if (game && !game.completed) {
        allFinal = false;
        continue; // can't grade this entry yet
      }
      if (!game) {
        // Pick references a team with no result in scope — wait rather than
        // wrongly penalize (e.g. postponed). Keeps grading idempotent.
        allFinal = false;
        continue;
      }
    }

    const outcome = pickOutcome(pick, resultsByTeam);
    if (outcome === "pending") {
      allFinal = false;
      continue;
    }

    if (pick) pickUpdates.push({ entry_id: entry.id, result: outcome });

    if (outcome === "win") continue; // survive, bracket unchanged

    // outcome === "loss" -> transition bracket
    if (entry.bracket === "main") {
      entryUpdates.push({
        id: entry.id,
        bracket: "losers",
        eliminated_week: entry.eliminated_week ?? week, // first life lost
      });
    } else {
      // losers bracket loss => fully eliminated
      entryUpdates.push({
        id: entry.id,
        bracket: "eliminated",
        eliminated_week: entry.eliminated_week ?? week,
      });
    }
  }

  return { entryUpdates, pickUpdates, allFinal };
}
