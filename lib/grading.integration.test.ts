// Integration-ish test: drive the real grading pipeline using the actual 2024
// week-1 ESPN fixture (real winners) end to end through normalize -> gradeWeek.
// No DB; this proves the rule chain a seeded DB run would exercise.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { normalizeScoreboard } from "./espn";
import { gradeWeek, type GradeInput } from "./grading";

const fixture = JSON.parse(
  readFileSync(join(__dirname, "../__fixtures__/espn-2024-wk1.json"), "utf8"),
);

function resultsByTeam(games: ReturnType<typeof normalizeScoreboard>) {
  const map: GradeInput["resultsByTeam"] = {};
  for (const g of games) {
    const r = { winnerAbbr: g.winnerAbbr, completed: g.completed };
    map[g.homeAbbr] = r;
    map[g.awayAbbr] = r;
  }
  return map;
}

describe("2024 wk1 end-to-end grading", () => {
  const games = normalizeScoreboard(fixture);
  const rbt = resultsByTeam(games);

  it("KC won wk1, so a KC pick survives and a BAL pick loses", () => {
    const out = gradeWeek({
      week: 1,
      entries: [
        { id: "winner", bracket: "main", eliminated_week: null },
        { id: "loser", bracket: "main", eliminated_week: null },
      ],
      picks: [
        { entry_id: "winner", team_abbr: "KC", bracket: "main" },
        { entry_id: "loser", team_abbr: "BAL", bracket: "main" },
      ],
      resultsByTeam: rbt,
    });

    expect(out.pickUpdates).toContainEqual({ entry_id: "winner", result: "win" });
    expect(out.pickUpdates).toContainEqual({ entry_id: "loser", result: "loss" });
    expect(out.entryUpdates.find((u) => u.id === "winner")).toBeUndefined();
    expect(out.entryUpdates.find((u) => u.id === "loser")?.bracket).toBe("losers");
    expect(out.allFinal).toBe(true);
  });

  it("all 16 wk1 games are final in the fixture", () => {
    expect(games.every((g) => g.completed)).toBe(true);
    expect(games).toHaveLength(16);
  });
});
