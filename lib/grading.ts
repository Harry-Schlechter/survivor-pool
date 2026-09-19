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
// `gradeWeek` is a PURE function over plain rows so it is fully unit-testable.
// It is idempotent ONLY because each GradePick carries its current stored
// result and each GradeEntry's eliminated_week is checked against the week
// being graded — both are what let a repeat call recognize "already handled"
// and skip re-applying a loss. Earlier versions of this file claimed
// idempotency without actually implementing it: a second grading pass over
// an unchanged loss would re-apply the SAME transition (main->losers, then
// losers->eliminated) because nothing marked it as already done. That
// eliminated 14 players who had actually WON week 1, on 2026-09-16, when
// sync-scores' twice-daily tick re-graded the same finished week more than
// once before it advanced. Do not remove the guards below.

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
  /**
   * The pick's CURRENT stored result, before this grading pass. Required for
   * real idempotency: without it, a second grading pass over an
   * already-graded loss (e.g. a repeat sync-scores tick before the week
   * advances) re-applies the SAME loss and pushes the entry down another
   * bracket (main->losers on pass 1, losers->eliminated on pass 2) even
   * though nothing changed. Skip any pick whose result is already final.
   */
  result: "pending" | "win" | "loss";
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

    // Already graded THIS week — what makes re-running gradeWeek on the same
    // week safe. Two cases:
    //  1. A submitted pick whose result is already final (win/loss) — a
    //     second pass would otherwise treat entry.bracket (already moved to
    //     "losers" by the first pass) as the starting point and apply a
    //     SECOND loss transition, eliminating someone for a loss already
    //     accounted for.
    //  2. A MISSING pick that already caused this week's transition — there
    //     is no picks row to check a stored result on, so this is detected
    //     via entry.eliminated_week already equalling the week being graded.
    //     Without this, a second pass over the same missing pick would apply
    //     a second automatic loss and eliminate someone for a no-pick that
    //     was already handled.
    if (pick) {
      if (pick.result !== "pending") continue;
    } else if (entry.eliminated_week === week) {
      continue;
    }

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

/**
 * A week is only safe to grade once EVERY one of its games is completed —
 * not merely once lock has passed. Lock happens at first kickoff (Wed/Thu
 * night); the week's real outcome isn't known until Sunday/Monday's games
 * are over, days later. Called from lib/season-ops.ts's
 * syncAndGradeCurrentWeek before it ever calls gradeWeek above.
 *
 * Two real incidents came from grading running too early, both from a guard
 * that looked right but was never exercised by a test:
 *   - 2026-09-16: the Tuesday-morning tick graded a JUST-advanced week that
 *     had zero picks yet, treating every missing pick as an instant loss.
 *   - 2026-09-19: a guard keyed on "lock has passed" let a missing pick be
 *     graded as an instant loss the moment lock passed (Wed/Thu night) —
 *     days before that week's Sunday/Monday games were even played.
 * Kept in this file (no DB import) rather than lib/season-ops.ts so it's
 * directly unit-testable the same way gradeWeek is.
 */
export function isWeekReadyToGrade(
  weekGames: { completed: boolean }[],
): boolean {
  return weekGames.length > 0 && weekGames.every((g) => g.completed);
}
