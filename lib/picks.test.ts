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
    priorTeamAbbrsThisSeason: [],
    entryPaid: true,
    entryActive: true,
    ...overrides,
  };
}

describe("validatePick", () => {
  it("accepts a valid first pick", () => {
    expect(validatePick(input())).toEqual({ ok: true });
  });

  it("allows an unpaid entry to pick", () => {
    // Payment is tracked but never blocks picking — a player must not lose a
    // week waiting on an admin to confirm their Venmo.
    expect(validatePick(input({ entryPaid: false })).ok).toBe(true);
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
      validatePick(input({ priorTeamAbbrsThisSeason: ["KC", "KC"] })).error,
    ).toBe("team_used_max");
  });

  it("allows a 2nd use of a team", () => {
    expect(
      validatePick(input({ priorTeamAbbrsThisSeason: ["KC"] })).ok,
    ).toBe(true);
  });

  it("allows unlimited reuse during playoffs", () => {
    expect(
      validatePick(
        input({
          phase: "playoffs",
          priorTeamAbbrsThisSeason: ["KC", "KC", "KC"],
        }),
      ).ok,
    ).toBe(true);
  });

  it("carries winners-pool usage into the losers bracket", () => {
    // The two-use cap is season-long: dropping to the losers bracket does NOT
    // hand back teams already burned in the winners pool.
    expect(
      validatePick(
        input({ bracket: "losers", priorTeamAbbrsThisSeason: ["KC", "KC"] }),
      ).error,
    ).toBe("team_used_max");
  });

  it("allows a team in the losers bracket when only used once overall", () => {
    expect(
      validatePick(
        input({ bracket: "losers", priorTeamAbbrsThisSeason: ["KC"] }),
      ).ok,
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
