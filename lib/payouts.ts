// Payout computation. Pure function so the split math is unit-tested.
//
// Rules (locked in with the user):
//   - Pot = (# paid entries) * buy_in, unless an explicit pot override is set.
//   - Normal split: 80% to the last-standing player in the MAIN/winners pool,
//     20% to the last-standing player in the LOSERS pool.
//   - Edge case: if the winners (main) pool empties in a week with NO surviving
//     winner, the entire pot (100%) goes to the losers-bracket winner.
//   - Off-site split negotiation is allowed but not modeled here.

export interface PayoutInput {
  paidEntryCount: number;
  buyIn: number;
  potOverride?: number | null;
  /** display_name of the last-standing main/winners player, or null if none. */
  winnersChampion: string | null;
  /** display_name of the last-standing losers player, or null if none. */
  losersChampion: string | null;
}

export interface PayoutShare {
  label: string; // "Winners bracket champion" etc.
  name: string | null;
  pct: number; // 0..1
  amount: number;
}

export interface PayoutResult {
  pot: number;
  shares: PayoutShare[];
  note?: string;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computePayouts(input: PayoutInput): PayoutResult {
  const pot =
    input.potOverride != null && input.potOverride >= 0
      ? input.potOverride
      : input.paidEntryCount * input.buyIn;

  // Edge case: no winners-pool survivor -> 100% to losers champion.
  if (!input.winnersChampion && input.losersChampion) {
    return {
      pot,
      shares: [
        {
          label: "Losers bracket champion (winners pool emptied)",
          name: input.losersChampion,
          pct: 1,
          amount: round2(pot),
        },
      ],
      note:
        "Winners pool emptied with no surviving champion, so the entire pot " +
        "goes to the last player standing in the losers bracket.",
    };
  }

  const shares: PayoutShare[] = [
    {
      label: "Winners bracket champion",
      name: input.winnersChampion,
      pct: 0.8,
      amount: round2(pot * 0.8),
    },
    {
      label: "Losers bracket champion",
      name: input.losersChampion,
      pct: 0.2,
      amount: round2(pot * 0.2),
    },
  ];

  return { pot, shares };
}
