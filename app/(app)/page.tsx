import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";
import {
  getCurrentSeason,
  getEntry,
  signupsOpen,
} from "@/lib/queries/seasons";
import { getStandings, type StandingRow } from "@/lib/queries/standings";
import { teamName } from "@/lib/teams";
import { TeamLogo } from "@/components/team-logo";
import { computePayouts } from "@/lib/payouts";

export default async function Dashboard() {
  const user = await requireUser();
  const season = await getCurrentSeason();

  if (!season) {
    return (
      <Empty title="No active season yet">
        Check back when signups open for the next NFL season.
      </Empty>
    );
  }

  const myEntry = await getEntry(season.id, user.id);
  const standings = await getStandings(
    season.id,
    season.currentWeek,
    season.lockAt,
    user.id,
  );

  const myActive =
    myEntry?.paid &&
    (myEntry.bracket === "main" || myEntry.bracket === "losers");
  const myRow = [...standings.main, ...standings.losers].find(
    (r) => r.entryId === myEntry?.id,
  );
  const needsPick =
    season.status === "active" &&
    myActive &&
    !standings.locked &&
    !myRow?.hasPick;

  return (
    <div className="space-y-6">
      <SeasonHeader season={season} />

      {signupsOpen(season) && !myEntry && (
        <Link href="/signup" className="block rounded-lg bg-field p-5 text-white">
          <div className="text-lg font-semibold">Signups are open →</div>
          <div className="text-sm text-white/80">
            Join the {season.year} pool. Buy-in ${season.buyIn}.
          </div>
        </Link>
      )}

      {myEntry && !myEntry.paid && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
          You&apos;re signed up but not yet marked paid. Send the buy-in via
          Venmo, then{" "}
          <Link href="/signup" className="font-semibold underline">
            confirm payment
          </Link>
          . The admin will verify it.
        </div>
      )}

      {needsPick && (
        <Link href="/pick" className="block rounded-lg bg-red-600 p-5 text-white">
          <div className="text-lg font-semibold">
            ⏰ You haven&apos;t picked Week {season.currentWeek} yet!
          </div>
          <div className="text-sm text-white/90">
            Picks lock {formatLock(season.lockAt)}. Tap to pick →
          </div>
        </Link>
      )}

      {!needsPick && myActive && myRow?.thisWeekPick && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 p-4 text-green-900">
          <span>Your Week {season.currentWeek} pick:</span>
          <TeamLogo abbr={myRow.thisWeekPick} size={20} />
          <strong>{teamName(myRow.thisWeekPick)}</strong>
          {!standings.locked && (
            <>
              {" "}
              —{" "}
              <Link href="/pick" className="underline">
                change before lock
              </Link>
            </>
          )}
        </div>
      )}

      <BracketTable
        title="🏆 Winners pool (alive)"
        rows={standings.main}
        locked={standings.locked}
      />
      <BracketTable
        title="🩹 Losers bracket (alive)"
        rows={standings.losers}
        locked={standings.locked}
      />
      <BracketTable
        title="☠️ Eliminated"
        rows={standings.eliminated}
        locked={standings.locked}
        showElimWeek
      />

      {(season.status === "complete" || season.status === "archived") && (
        <PayoutCard season={season} standings={standings} />
      )}
    </div>
  );
}

function SeasonHeader({
  season,
}: {
  season: { year: number; status: string; phase: string; currentWeek: number };
}) {
  const phaseLabel =
    season.phase === "playoffs" ? "Playoffs" : `Week ${season.currentWeek}`;
  return (
    <div className="flex items-baseline justify-between">
      <h1 className="text-2xl font-bold text-field">
        {season.year} Jim Olah Survivor Pool
      </h1>
      <span className="rounded-full bg-field/10 px-3 py-1 text-sm font-medium text-field">
        {season.status === "active" ? phaseLabel : season.status}
      </span>
    </div>
  );
}

function BracketTable({
  title,
  rows,
  locked,
  showElimWeek,
}: {
  title: string;
  rows: StandingRow[];
  locked: boolean;
  showElimWeek?: boolean;
}) {
  if (rows.length === 0) return null;
  return (
    <section>
      <h2 className="mb-2 text-lg font-semibold">
        {title} <span className="text-gray-400">({rows.length})</span>
      </h2>
      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.entryId}
                className="border-b border-gray-100 last:border-0"
              >
                <td className="px-4 py-2">
                  <Link
                    href={`/profile/${r.userId}`}
                    className="font-medium hover:underline"
                  >
                    {r.displayName}
                  </Link>
                </td>
                <td className="px-4 py-2 text-right text-gray-600">
                  {showElimWeek ? (
                    r.eliminatedWeek ? (
                      `out wk ${r.eliminatedWeek}`
                    ) : (
                      ""
                    )
                  ) : locked ? (
                    <PickCell row={r} />
                  ) : r.hasPick ? (
                    "✅ picked"
                  ) : (
                    "— no pick"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PickCell({ row }: { row: StandingRow }) {
  if (!row.thisWeekPick) return <span>— no pick</span>;
  const mark =
    row.thisWeekResult === "win"
      ? "✅"
      : row.thisWeekResult === "loss"
        ? "❌"
        : "•";
  return (
    <span className="inline-flex items-center justify-end gap-1.5">
      <span>{mark}</span>
      <TeamLogo abbr={row.thisWeekPick} size={18} withName />
    </span>
  );
}

function PayoutCard({
  season,
  standings,
}: {
  season: { buyIn: string; potOverride: string | null };
  standings: { main: StandingRow[]; losers: StandingRow[] };
}) {
  const paidCount = standings.main.length + standings.losers.length;
  const result = computePayouts({
    paidEntryCount: paidCount,
    buyIn: Number(season.buyIn),
    potOverride: season.potOverride != null ? Number(season.potOverride) : null,
    winnersChampion: standings.main[0]?.displayName ?? null,
    losersChampion: standings.losers[0]?.displayName ?? null,
  });
  return (
    <section className="rounded-lg border border-field/30 bg-field/5 p-5">
      <h2 className="mb-2 text-lg font-semibold text-field">
        💰 Payouts — pot ${result.pot.toFixed(2)}
      </h2>
      <ul className="space-y-1 text-sm">
        {result.shares.map((s) => (
          <li key={s.label} className="flex justify-between">
            <span>
              {s.label}: <strong>{s.name ?? "—"}</strong>
            </span>
            <span>${s.amount.toFixed(2)}</span>
          </li>
        ))}
      </ul>
      {result.note && <p className="mt-2 text-xs text-gray-600">{result.note}</p>}
    </section>
  );
}

function Empty({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-gray-200 p-8 text-center">
      <h1 className="mb-2 text-xl font-semibold">{title}</h1>
      <p className="text-gray-600">{children}</p>
    </div>
  );
}

function formatLock(lockAt: Date | null): string {
  if (!lockAt) return "soon";
  return new Date(lockAt).toLocaleString("en-US", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
    timeZoneName: "short",
  });
}
