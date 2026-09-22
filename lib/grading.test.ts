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
      { id: "e1", bracket: "main", eliminated_week: null, last_graded_week: null },
      { id: "e2", bracket: "main", eliminated_week: null, last_graded_week: null },
      { id: "e3", bracket: "losers", eliminated_week: null, last_graded_week: 1 },
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

  it("drops a main-bracket loser into the losers bracket WITHOUT setting eliminated_week", () => {
    // 2026-09-22 fix: eliminated_week means "the week they were actually
    // eliminated" everywhere it's read (site, tue-summary recap, career
    // stats). A main->losers drop is a survivable first loss, not an
    // elimination, so it must stay null. last_graded_week (not displayed
    // anywhere) is what tracks that this entry was touched this week.
    const out = gradeWeek(base());
    expect(out.entryUpdates).toContainEqual({
      id: "e2",
      bracket: "losers",
      eliminated_week: null,
      last_graded_week: 3,
    });
    expect(out.pickUpdates).toContainEqual({ entry_id: "e2", result: "loss" });
  });

  it("eliminates a losers-bracket loser entirely and stamps eliminated_week to the CURRENT week", () => {
    const out = gradeWeek(base());
    const u = out.entryUpdates.find((x) => x.id === "e3");
    expect(u?.bracket).toBe("eliminated");
    // e3 was already in losers (from some earlier week) and loses again NOW,
    // in week 3 — THAT is the real elimination week, not whenever they first
    // dropped out of main.
    expect(u?.eliminated_week).toBe(3);
    expect(u?.last_graded_week).toBe(3);
  });

  it("grades a tie as a loss", () => {
    const out = gradeWeek(
      base({
        entries: [{ id: "t", bracket: "main", eliminated_week: null, last_graded_week: null }],
        picks: [{ entry_id: "t", team_abbr: "NYG", bracket: "main", result: "pending" }],
      }),
    );
    expect(out.pickUpdates).toContainEqual({ entry_id: "t", result: "loss" });
    expect(out.entryUpdates[0].bracket).toBe("losers");
    expect(out.entryUpdates[0].eliminated_week).toBeNull();
  });

  it("grades a missing pick as an automatic loss (main -> losers, not eliminated)", () => {
    const out = gradeWeek(
      base({
        entries: [{ id: "m", bracket: "main", eliminated_week: null, last_graded_week: null }],
        picks: [], // no pick submitted
      }),
    );
    expect(out.entryUpdates).toContainEqual({
      id: "m",
      bracket: "losers",
      eliminated_week: null,
      last_graded_week: 3,
    });
    expect(out.allFinal).toBe(true); // nothing to wait on
  });

  it("skips already-eliminated entries", () => {
    const out = gradeWeek(
      base({
        entries: [{ id: "dead", bracket: "eliminated", eliminated_week: 1, last_graded_week: 1 }],
        picks: [],
      }),
    );
    expect(out.entryUpdates).toHaveLength(0);
    expect(out.pickUpdates).toHaveLength(0);
  });

  it("waits (allFinal=false) when a picked game is not final", () => {
    const out = gradeWeek(
      base({
        entries: [{ id: "w", bracket: "main", eliminated_week: null, last_graded_week: null }],
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
  // each pick's already-stored result, and (for a missing pick, which has
  // no stored result to check) each entry's last_graded_week.
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
            { id: "e1", bracket: "main", eliminated_week: null, last_graded_week: null },
            { id: "e2", bracket: "losers", eliminated_week: null, last_graded_week: 3 },
            { id: "e3", bracket: "losers", eliminated_week: null, last_graded_week: 1 },
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
      // Pass 1: no pick submitted, entry drops main -> losers.
      // last_graded_week stamped to the week being graded; eliminated_week
      // stays null (this was a survivable first loss, not an elimination).
      const first = gradeWeek(
        base({
          entries: [{ id: "m", bracket: "main", eliminated_week: null, last_graded_week: null }],
          picks: [],
        }),
      );
      expect(first.entryUpdates[0]).toEqual({
        id: "m",
        bracket: "losers",
        eliminated_week: null,
        last_graded_week: 3,
      });

      // Pass 2: same week, same missing pick, entry now reflects pass 1's
      // bracket AND last_graded_week — must not be pushed to "eliminated".
      const second = gradeWeek(
        base({
          entries: [{ id: "m", bracket: "losers", eliminated_week: null, last_graded_week: 3 }],
          picks: [],
        }),
      );
      expect(second.entryUpdates).toHaveLength(0);
    });

    it("still grades a genuinely NEW week's loss for an entry already in losers", () => {
      // "m" lost week 3 (handled above) but was NOT eliminated by it — just
      // dropped to losers. In week 4 they lose again for real — THIS is
      // their actual elimination, and eliminated_week must record week 4,
      // not week 3.
      const week4 = gradeWeek({
        week: 4,
        entries: [{ id: "m", bracket: "losers", eliminated_week: null, last_graded_week: 3 }],
        picks: [{ entry_id: "m", team_abbr: "DAL", bracket: "losers", result: "pending" }],
        resultsByTeam: results,
      });
      expect(week4.entryUpdates).toContainEqual({
        id: "m",
        bracket: "eliminated",
        eliminated_week: 4, // the week they were ACTUALLY eliminated
        last_graded_week: 4,
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
            { id: "e1", bracket: "main", eliminated_week: null, last_graded_week: null },
            { id: "e2", bracket: "losers", eliminated_week: null, last_graded_week: 3 },
            { id: "e3", bracket: "eliminated", eliminated_week: 3, last_graded_week: 3 },
          ],
        }),
      );
      expect(second.entryUpdates.find((u) => u.id === "e1")).toBeUndefined();
    });
  });

  // Regression coverage for the 2026-09-22 report: the site's Eliminated
  // table showed "out wk 1" for players who took TWO losses (week 1 dropped
  // them to losers, week 2 actually eliminated them) — impossible under the
  // stated rule (it takes two losses to be eliminated). Cause: eliminated_week
  // was stamped on the FIRST loss and never overwritten, so it recorded "when
  // they first dropped to losers", not "when they were actually eliminated".
  // Same root cause separately broke the tue-summary recap: it lists anyone
  // with eliminated_week === the just-finished week as "eliminated", so a
  // player who merely dropped main->losers that week (still alive) was
  // reported as knocked out of the pool entirely.
  describe("eliminated_week semantics (regression: 2026-09-22 report)", () => {
    it("a two-loss elimination reports the SECOND loss's week, not the first", () => {
      // Week 1: lose, drop to losers (not eliminated).
      const week1 = gradeWeek({
        week: 1,
        entries: [{ id: "p", bracket: "main", eliminated_week: null, last_graded_week: null }],
        picks: [{ entry_id: "p", team_abbr: "DAL", bracket: "main", result: "pending" }],
        resultsByTeam: results,
      });
      const afterWeek1 = week1.entryUpdates.find((u) => u.id === "p")!;
      expect(afterWeek1.bracket).toBe("losers");
      expect(afterWeek1.eliminated_week).toBeNull();

      // Week 2: lose again from losers -> eliminated. This, week 2, is the
      // real elimination week — not week 1's first loss.
      const week2 = gradeWeek({
        week: 2,
        entries: [
          {
            id: "p",
            bracket: afterWeek1.bracket,
            eliminated_week: afterWeek1.eliminated_week,
            last_graded_week: afterWeek1.last_graded_week,
          },
        ],
        picks: [{ entry_id: "p", team_abbr: "DAL", bracket: "losers", result: "pending" }],
        resultsByTeam: results,
      });
      const afterWeek2 = week2.entryUpdates.find((u) => u.id === "p")!;
      expect(afterWeek2.bracket).toBe("eliminated");
      expect(afterWeek2.eliminated_week).toBe(2); // NOT 1
    });

    it("a player who only ever dropped to losers has eliminated_week null (never shown as eliminated)", () => {
      const out = gradeWeek(base());
      const e2 = out.entryUpdates.find((u) => u.id === "e2")!;
      expect(e2.bracket).toBe("losers");
      expect(e2.eliminated_week).toBeNull();
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
