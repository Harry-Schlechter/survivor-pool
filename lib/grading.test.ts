import { describe, it, expect } from "vitest";
import { gradeWeek, isWeekReadyToGrade, type GradeInput } from "./grading";

const results = {
  KC: { winnerAbbr: "KC", completed: true }, // KC won
  BAL: { winnerAbbr: "KC", completed: true }, // BAL lost
  PHI: { winnerAbbr: "PHI", completed: true }, // PHI won
  DAL: { winnerAbbr: "PHI", completed: true }, // DAL lost
  NYG: { winnerAbbr: null, completed: true }, // tie game
  WAS: { winnerAbbr: null, completed: false }, // not final yet
};

function base(overrides: Partial<GradeInput> = {}): GradeInput {
  return {
    week: 3,
    entries: [
      { id: "e1", bracket: "main", eliminated_week: null },
      { id: "e2", bracket: "main", eliminated_week: null },
      { id: "e3", bracket: "losers", eliminated_week: 1 },
    ],
    picks: [
      { entry_id: "e1", team_abbr: "KC", bracket: "main", result: "pending" }, // win
      { entry_id: "e2", team_abbr: "DAL", bracket: "main", result: "pending" }, // loss
      { entry_id: "e3", team_abbr: "BAL", bracket: "losers", result: "pending" }, // loss
    ],
    resultsByTeam: results,
    ...overrides,
  };
}

describe("gradeWeek", () => {
  it("survives a correct pick (no bracket change)", () => {
    const out = gradeWeek(base());
    expect(out.pickUpdates).toContainEqual({ entry_id: "e1", result: "win" });
    expect(out.entryUpdates.find((u) => u.id === "e1")).toBeUndefined();
  });

  it("drops a main-bracket loser into the losers bracket and stamps the week", () => {
    const out = gradeWeek(base());
    expect(out.entryUpdates).toContainEqual({
      id: "e2",
      bracket: "losers",
      eliminated_week: 3,
    });
    expect(out.pickUpdates).toContainEqual({ entry_id: "e2", result: "loss" });
  });

  it("eliminates a losers-bracket loser entirely", () => {
    const out = gradeWeek(base());
    const u = out.entryUpdates.find((x) => x.id === "e3");
    expect(u?.bracket).toBe("eliminated");
    expect(u?.eliminated_week).toBe(1); // keeps original first-loss week
  });

  it("grades a tie as a loss", () => {
    const out = gradeWeek(
      base({
        entries: [{ id: "t", bracket: "main", eliminated_week: null }],
        picks: [{ entry_id: "t", team_abbr: "NYG", bracket: "main", result: "pending" }],
      }),
    );
    expect(out.pickUpdates).toContainEqual({ entry_id: "t", result: "loss" });
    expect(out.entryUpdates[0].bracket).toBe("losers");
  });

  it("grades a missing pick as an automatic loss", () => {
    const out = gradeWeek(
      base({
        entries: [{ id: "m", bracket: "main", eliminated_week: null }],
        picks: [], // no pick submitted
      }),
    );
    expect(out.entryUpdates).toContainEqual({
      id: "m",
      bracket: "losers",
      eliminated_week: 3,
    });
    expect(out.allFinal).toBe(true); // nothing to wait on
  });

  it("skips already-eliminated entries", () => {
    const out = gradeWeek(
      base({
        entries: [{ id: "dead", bracket: "eliminated", eliminated_week: 1 }],
        picks: [],
      }),
    );
    expect(out.entryUpdates).toHaveLength(0);
    expect(out.pickUpdates).toHaveLength(0);
  });

  it("waits (allFinal=false) when a picked game is not final", () => {
    const out = gradeWeek(
      base({
        entries: [{ id: "w", bracket: "main", eliminated_week: null }],
        picks: [{ entry_id: "w", team_abbr: "WAS", bracket: "main", result: "pending" }],
      }),
    );
    expect(out.allFinal).toBe(false);
    expect(out.entryUpdates).toHaveLength(0);
  });

  // Regression coverage for the 2026-09-16 incident: sync-scores re-ran
  // syncAndGradeCurrentWeek for the same already-finished week more than
  // once (it has no "already fully graded" check of its own), and gradeWeek
  // had no way to tell an already-applied loss from a fresh one — so the
  // second pass re-applied the SAME loss and pushed 14 players who had
  // WON week 1 down an extra bracket (several genuinely lost, moved
  // main->losers correctly on pass 1, then losers->eliminated incorrectly
  // on pass 2 for the exact same result). Fixed by having gradeWeek check
  // each pick's already-stored result and each entry's eliminated_week.
  describe("idempotency (regression: 2026-09-16 double-grading incident)", () => {
    it("does NOT re-eliminate a main-bracket entry already dropped to losers this week", () => {
      const first = gradeWeek(base());
      const e2Update = first.entryUpdates.find((u) => u.id === "e2")!;
      expect(e2Update.bracket).toBe("losers"); // sanity: pass 1 is correct

      // Simulate what the DB looks like after pass 1's writes: e2 is now in
      // "losers", and its picks row has result="loss" persisted.
      const second = gradeWeek(
        base({
          entries: [
            { id: "e1", bracket: "main", eliminated_week: null },
            { id: "e2", bracket: "losers", eliminated_week: 3 },
            { id: "e3", bracket: "losers", eliminated_week: 1 },
          ],
          picks: [
            { entry_id: "e1", team_abbr: "KC", bracket: "main", result: "win" },
            { entry_id: "e2", team_abbr: "DAL", bracket: "main", result: "loss" },
            { entry_id: "e3", team_abbr: "BAL", bracket: "losers", result: "loss" },
          ],
        }),
      );

      // Nobody should move again — everything this week was already graded.
      expect(second.entryUpdates).toHaveLength(0);
      expect(second.pickUpdates).toHaveLength(0);
    });

    it("does NOT re-eliminate an entry whose loss came from a MISSING pick", () => {
      // Pass 1: no pick submitted, entry drops main -> losers, eliminated_week
      // stamped to the week being graded.
      const first = gradeWeek(
        base({
          entries: [{ id: "m", bracket: "main", eliminated_week: null }],
          picks: [],
        }),
      );
      expect(first.entryUpdates[0]).toEqual({
        id: "m",
        bracket: "losers",
        eliminated_week: 3,
      });

      // Pass 2: same week, same missing pick, entry now reflects pass 1's
      // bracket AND eliminated_week — must not be pushed to "eliminated".
      const second = gradeWeek(
        base({
          entries: [{ id: "m", bracket: "losers", eliminated_week: 3 }],
          picks: [],
        }),
      );
      expect(second.entryUpdates).toHaveLength(0);
    });

    it("still grades a genuinely NEW week's loss for an entry already in losers", () => {
      // "m" lost week 3 (handled above). In week 4 they lose again for real —
      // this must still eliminate them; only a repeat of the SAME week is
      // skipped.
      const week4 = gradeWeek({
        week: 4,
        entries: [{ id: "m", bracket: "losers", eliminated_week: 3 }],
        picks: [{ entry_id: "m", team_abbr: "DAL", bracket: "losers", result: "pending" }],
        resultsByTeam: results,
      });
      expect(week4.entryUpdates).toContainEqual({
        id: "m",
        bracket: "eliminated",
        eliminated_week: 3, // keeps the FIRST loss week, per the stated rule
      });
    });

    it("a repeated win changes nothing (was already safe, still covered)", () => {
      const second = gradeWeek(
        base({
          picks: [
            { entry_id: "e1", team_abbr: "KC", bracket: "main", result: "win" },
            { entry_id: "e2", team_abbr: "DAL", bracket: "main", result: "loss" },
            { entry_id: "e3", team_abbr: "BAL", bracket: "losers", result: "loss" },
          ],
          entries: [
            { id: "e1", bracket: "main", eliminated_week: null },
            { id: "e2", bracket: "losers", eliminated_week: 3 },
            { id: "e3", bracket: "eliminated", eliminated_week: 1 },
          ],
        }),
      );
      expect(second.entryUpdates.find((u) => u.id === "e1")).toBeUndefined();
    });
  });
});

// Regression coverage for two real incidents caused by grading running
// before a week's games were actually finished:
//
//   2026-09-16: the Tuesday-morning sync tick ran syncAndGradeCurrentWeek
//   against a JUST-advanced week that had zero picks yet, grading every
//   missing pick as an instant loss.
//
//   2026-09-19: a guard keyed on "lock has passed" let a missing pick be
//   graded as an instant loss the moment lock passed (Wed/Thu night) — days
//   before that week's Sunday/Monday games were even played.
//
// The fix in both cases is the same: grading may only run once EVERY game
// in the week is completed. isWeekReadyToGrade() is that single decision.
describe("isWeekReadyToGrade", () => {
  it("is false when no games exist yet for the week (freshly advanced)", () => {
    expect(isWeekReadyToGrade([])).toBe(false);
  });

  it("is false when even one game is still in progress (mid-week Sunday)", () => {
    expect(
      isWeekReadyToGrade([
        { completed: true },
        { completed: true },
        { completed: false }, // e.g. Monday Night Football, still playing
      ]),
    ).toBe(false);
  });

  it("is false right after lock, before ANY game has been played", () => {
    // This is the exact 2026-09-19 scenario: lock has passed (Wed/Thu
    // night) but Sunday/Monday's games haven't happened yet.
    expect(
      isWeekReadyToGrade([
        { completed: false },
        { completed: false },
        { completed: false },
      ]),
    ).toBe(false);
  });

  it("is true only once every game in the week is completed", () => {
    expect(
      isWeekReadyToGrade([
        { completed: true },
        { completed: true },
        { completed: true },
      ]),
    ).toBe(true);
  });
});
