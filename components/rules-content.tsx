export function RulesContent() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold text-field">
        🏈 How the Jim Olah Survivor Pool works
      </h1>

      <div className="space-y-5 text-gray-800">
        <Rule title="Sign up & pay">
          Each NFL season opens with a signup window. After you sign up, pay the
          buy-in to Lou — <strong>Venmo @Lou-Hirsch</strong> or{" "}
          <strong>cash in person</strong>. Lou marks you as paid once he has it.
          You can make your picks right away; you don&apos;t have to wait to be
          marked paid.
        </Rule>
        <Rule title="Pick one team every week">
          Each week, pick one team you think will <strong>win</strong>. After
          lock, everyone&apos;s picks are revealed.
        </Rule>
        <Rule title="The deadline: first kickoff">
          Picks are due at the{" "}
          <strong>kickoff of the first game of the week</strong> — usually
          Thursday night, but it moves for Thanksgiving, Christmas and other
          special weeks, so always check the pick page. The site locks entries{" "}
          <strong>automatically</strong> at that moment. Once it locks, nothing
          can be changed or submitted, and a missing pick counts as a{" "}
          <strong>loss</strong>.
        </Rule>
        <Rule title="You'll be reminded automatically">
          You don&apos;t have to remember on your own. If you haven&apos;t
          picked, the site emails you <strong>Thursday morning</strong> and
          again <strong>about an hour before kickoff</strong> as a last call.
          Both are sent only to players who still haven&apos;t entered a pick —
          once yours is in, the reminders stop.
        </Rule>
        <Rule title="The two-time rule">
          During the regular season you may use any team{" "}
          <strong>at most twice — for the whole season</strong>. That cap
          follows you everywhere: picks you burned in the winners pool still
          count against you in the losers bracket. Choose wisely.
        </Rule>
        <Rule title="Win or you drop">
          Pick the winner and you survive. Pick a loser — or a tie, or forget to
          pick — and it counts as a <strong>loss</strong>. A loss in the main
          (winners) pool drops you into the <strong>losers bracket</strong>. Lose
          there and you&apos;re out for good.
        </Rule>
        <Rule title="No fresh slate in the losers bracket">
          Dropping into the losers bracket does <strong>not</strong> reset your
          team usage. If you already used a team twice, it stays off the board
          for the rest of the regular season.
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
        <Rule title="2026 season">
          Signups are open now and close at the{" "}
          <strong>kickoff of the first game of the season</strong> —{" "}
          <strong>Wednesday, September 9 at 8:00pm ET</strong>. Join any time
          before then; once that game kicks off, the season is locked and no
          new entries are accepted. Week 1 picks are open as soon as you sign
          up, so you can enter yours right away.
        </Rule>
        <Rule title="Questions or trouble?">
          Email{" "}
          <a
            href="mailto:harry.schlechter391@gmail.com"
            className="font-semibold text-field underline"
          >
            harry.schlechter391@gmail.com
          </a>{" "}
          for help with signups, payment, picks, or anything that looks broken.
        </Rule>
      </div>
    </div>
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
