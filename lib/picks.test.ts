import { describe, it, expect } from "vitest";
import { validatePick, remainingUses, type ValidatePickInput } from "./picks";

const baseGames = [
  { homeAbbr: "KC", awayAbbr: "BAL" },
  { homeAbbr: "PHI", awayAbbr: "DAL" },
];

function input(overrides: Partial<ValidatePickInput> = {}): ValidatePickInput {
  return {
    teamAbbr: "KC",
    bracket: "main",
    phase: "regular",
    lockAt: "2024-09-06T00:40:00Z",
    now: new Date("2024-09-05T12:00:00Z"), // before lock
    weekGames: baseGames,
    priorTeamAbbrsThisBracket: [],
    entryPaid: true,
    entryActive: true,
    ...overrides,
  };
}

describe("validatePick", () => {
  it("accepts a valid first pick", () => {
    expect(validatePick(input())).toEqual({ ok: true });
  });

  it("rejects unpaid entry", () => {
    expect(validatePick(input({ entryPaid: false })).error).toBe("not_paid");
  });

  it("rejects eliminated/inactive entry", () => {
    expect(validatePick(input({ entryActive: false })).error).toBe("not_active");
  });

  it("rejects picks after lock", () => {
    expect(
      validatePick(input({ now: new Date("2024-09-06T01:00:00Z") })).error,
    ).toBe("locked");
  });

  it("treats null lock as open", () => {
    expect(validatePick(input({ lockAt: null })).ok).toBe(true);
  });

  it("rejects a team not playing this week", () => {
    expect(validatePick(input({ teamAbbr: "NYJ" })).error).toBe(
      "team_not_in_week",
    );
  });

  it("rejects a 3rd use of the same team in the regular season", () => {
    expect(
      validatePick(input({ priorTeamAbbrsThisBracket: ["KC", "KC"] })).error,
    ).toBe("team_used_max");
  });

  it("allows a 2nd use of a team", () => {
    expect(
      validatePick(input({ priorTeamAbbrsThisBracket: ["KC"] })).ok,
    ).toBe(true);
  });

  it("allows unlimited reuse during playoffs", () => {
    expect(
      validatePick(
        input({
          phase: "playoffs",
          priorTeamAbbrsThisBracket: ["KC", "KC", "KC"],
        }),
      ).ok,
    ).toBe(true);
  });

  it("does not count other brackets' usage (fresh slate per bracket-run)", () => {
    // priorTeamAbbrsThisBracket is already scoped to the current bracket, so a
    // losers-bracket entry with no losers picks sees KC as unused.
    expect(
      validatePick(input({ bracket: "losers", priorTeamAbbrsThisBracket: [] }))
        .ok,
    ).toBe(true);
  });
});

describe("remainingUses", () => {
  it("returns 2 for an unused team in the regular season", () => {
    expect(remainingUses("KC", "regular", [])).toBe(2);
  });
  it("returns 1 after one use", () => {
    expect(remainingUses("KC", "regular", ["KC"])).toBe(1);
  });
  it("returns 0 after two uses", () => {
    expect(remainingUses("KC", "regular", ["KC", "KC"])).toBe(0);
  });
  it("returns Infinity in playoffs", () => {
    expect(remainingUses("KC", "playoffs", ["KC", "KC"])).toBe(Infinity);
  });
});
