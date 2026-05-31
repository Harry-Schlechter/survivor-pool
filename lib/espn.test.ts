import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { normalizeScoreboard, earliestKickoff } from "./espn";

const fixture = JSON.parse(
  readFileSync(join(__dirname, "../__fixtures__/espn-2024-wk1.json"), "utf8"),
);

describe("normalizeScoreboard (2024 wk1 fixture)", () => {
  const games = normalizeScoreboard(fixture);

  it("parses all 16 games", () => {
    expect(games).toHaveLength(16);
  });

  it("parses the opener KC 27, BAL 20 with KC as winner", () => {
    const opener = games.find((g) => g.id === "401671789");
    expect(opener).toBeDefined();
    expect(opener!.homeAbbr).toBe("KC");
    expect(opener!.awayAbbr).toBe("BAL");
    expect(opener!.homeScore).toBe(27);
    expect(opener!.awayScore).toBe(20);
    expect(opener!.winnerAbbr).toBe("KC");
    expect(opener!.completed).toBe(true);
    expect(opener!.status).toBe("STATUS_FINAL");
  });

  it("coerces string scores to numbers", () => {
    for (const g of games) {
      if (g.homeScore !== null) expect(typeof g.homeScore).toBe("number");
    }
  });

  it("earliestKickoff returns the first ISO time", () => {
    const k = earliestKickoff(games);
    expect(k).toBeTruthy();
    // every other kickoff is >= the earliest
    for (const g of games) expect(g.kickoff >= k!).toBe(true);
  });
});

describe("tie handling", () => {
  it("grades equal final scores as no winner (null)", () => {
    const tie = normalizeScoreboard({
      week: { number: 1 },
      season: { type: 2, year: 2024 },
      events: [
        {
          id: "tie1",
          date: "2024-09-08T17:00Z",
          week: { number: 1 },
          season: { type: 2 },
          competitions: [
            {
              status: { type: { name: "STATUS_FINAL", completed: true } },
              competitors: [
                { homeAway: "home", score: "17", winner: false, team: { abbreviation: "NYG", displayName: "New York Giants" } },
                { homeAway: "away", score: "17", winner: false, team: { abbreviation: "DAL", displayName: "Dallas Cowboys" } },
              ],
            },
          ],
        },
      ],
    });
    expect(tie[0].winnerAbbr).toBeNull();
  });
});
