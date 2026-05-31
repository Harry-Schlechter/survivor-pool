import { describe, it, expect } from "vitest";
import { computeCareerStats } from "./stats";

const entries = [
  { id: "e1", season_id: "s2023", eliminated_week: 5, final_rank: 3 },
  { id: "e2", season_id: "s2024", eliminated_week: null, final_rank: 1 },
];

const picks = [
  { entry_id: "e1", season_id: "s2023", week: 1, team_abbr: "KC", result: "win" as const },
  { entry_id: "e1", season_id: "s2023", week: 2, team_abbr: "KC", result: "loss" as const },
  { entry_id: "e2", season_id: "s2024", week: 1, team_abbr: "PHI", result: "win" as const },
  { entry_id: "e2", season_id: "s2024", week: 2, team_abbr: "BUF", result: "win" as const },
];

describe("computeCareerStats", () => {
  const s = computeCareerStats(entries, picks);

  it("counts seasons, wins, losses", () => {
    expect(s.seasonsPlayed).toBe(2);
    expect(s.wins).toBe(3);
    expect(s.losses).toBe(1);
  });

  it("finds the most-picked team", () => {
    expect(s.mostPickedTeam).toEqual({ abbr: "KC", count: 2 });
  });

  it("averages elimination week over eliminated seasons only", () => {
    expect(s.avgEliminationWeek).toBe(5);
  });

  it("averages final rank and reports best finish", () => {
    expect(s.avgFinalRank).toBe(2);
    expect(s.bestFinish).toBe(1);
  });

  it("computes current streak from the latest season's trailing wins", () => {
    expect(s.currentStreak).toBe(2); // s2024: PHI win, BUF win
  });

  it("handles an empty history", () => {
    const e = computeCareerStats([], []);
    expect(e.seasonsPlayed).toBe(0);
    expect(e.mostPickedTeam).toBeNull();
    expect(e.avgEliminationWeek).toBeNull();
  });
});
