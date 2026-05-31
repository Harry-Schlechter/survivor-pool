export default function RulesPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <a href="/" className="text-sm text-field underline">
        ← Back
      </a>
      <h1 className="mb-6 mt-4 text-3xl font-bold text-field">
        🏈 How the Survivor Pool works
      </h1>

      <div className="space-y-5 text-gray-800">
        <Rule title="Sign up & pay">
          Each NFL season opens with a signup window. Pay the buy-in via Venmo
          and you&apos;re entered once the admin confirms your payment.
        </Rule>
        <Rule title="Pick one team every week">
          Each week, pick one team you think will <strong>win</strong>. Picks
          lock at the first game of the week (usually Thursday ~8pm ET). After
          lock, everyone&apos;s picks are revealed.
        </Rule>
        <Rule title="The two-time rule">
          During the regular season you may use any team{" "}
          <strong>at most twice</strong>. Choose wisely.
        </Rule>
        <Rule title="Win or you drop">
          Pick the winner and you survive. Pick a loser — or a tie, or forget to
          pick — and it counts as a <strong>loss</strong>. A loss in the main
          (winners) pool drops you into the <strong>losers bracket</strong>. Lose
          there and you&apos;re out for good.
        </Rule>
        <Rule title="Fresh slate in the losers bracket">
          When you enter the losers bracket, your two-time team usage resets —
          all teams are available again for the consolation run.
        </Rule>
        <Rule title="Playoffs">
          If players are still alive when the playoffs start, everyone keeps
          picking weekly — but the two-time limit is lifted. Pick any team, any
          number of times, until a champion remains.
        </Rule>
        <Rule title="Super Bowl tiebreaker">
          Entering the Super Bowl, each remaining player guesses the total
          combined score. If more than one player is still tied for the win, the
          closest guess decides it.
        </Rule>
        <Rule title="Payouts">
          80% of the pot goes to the last player standing in the winners pool,
          20% to the last standing in the losers bracket. If the winners pool
          empties in a week with no survivor, the entire pot goes to the losers
          bracket champion. Players may negotiate splits among themselves
          off-site.
        </Rule>
      </div>
    </main>
  );
}

function Rule({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="font-semibold text-field">{title}</h2>
      <p className="text-sm leading-relaxed">{children}</p>
    </div>
  );
}
