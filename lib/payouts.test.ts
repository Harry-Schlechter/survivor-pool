import { describe, it, expect } from "vitest";
import { computePayouts } from "./payouts";

describe("computePayouts", () => {
  it("computes pot from paid entries x buy-in", () => {
    const r = computePayouts({
      paidEntryCount: 10,
      buyIn: 50,
      winnersChampion: "Harry",
      losersChampion: "Syd",
    });
    expect(r.pot).toBe(500);
  });

  it("splits 80/20 between winners and losers champions", () => {
    const r = computePayouts({
      paidEntryCount: 10,
      buyIn: 50,
      winnersChampion: "Harry",
      losersChampion: "Syd",
    });
    expect(r.shares.find((s) => s.pct === 0.8)?.amount).toBe(400);
    expect(r.shares.find((s) => s.pct === 0.2)?.amount).toBe(100);
  });

  it("gives 100% to losers champion when winners pool emptied", () => {
    const r = computePayouts({
      paidEntryCount: 10,
      buyIn: 50,
      winnersChampion: null,
      losersChampion: "Syd",
    });
    expect(r.shares).toHaveLength(1);
    expect(r.shares[0].pct).toBe(1);
    expect(r.shares[0].amount).toBe(500);
    expect(r.note).toContain("entire pot");
  });

  it("honors an explicit pot override", () => {
    const r = computePayouts({
      paidEntryCount: 10,
      buyIn: 50,
      potOverride: 1000,
      winnersChampion: "Harry",
      losersChampion: "Syd",
    });
    expect(r.pot).toBe(1000);
    expect(r.shares.find((s) => s.pct === 0.8)?.amount).toBe(800);
  });

  it("rounds shares to cents", () => {
    const r = computePayouts({
      paidEntryCount: 3,
      buyIn: 33.33,
      winnersChampion: "A",
      losersChampion: "B",
    });
    // pot = 99.99; 80% = 79.992 -> 79.99
    expect(r.shares[0].amount).toBe(79.99);
  });
});
