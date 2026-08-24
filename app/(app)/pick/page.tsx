import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";
import { getCurrentSeason, getEntry } from "@/lib/queries/seasons";
import {
  getWeekGames,
  getEntrySeasonPicks,
  getEntryWeekPick,
} from "@/lib/queries/picks";
import { PickForm } from "@/components/pick-form";
import { PickPanel } from "@/components/pick-panel";

export default async function PickPage() {
  const user = await requireUser();
  const season = await getCurrentSeason();

  if (!season || season.status !== "active") {
    return <Notice>No week is open for picks right now.</Notice>;
  }

  const entry = await getEntry(season.id, user.id);
  if (!entry) {
    return (
      <Notice>
        You&apos;re not in this season.{" "}
        <Link href="/signup" className="underline">
          Sign up
        </Link>
        .
      </Notice>
    );
  }
  if (entry.bracket === "eliminated") {
    return <Notice>You&apos;ve been eliminated — no more picks. ☠️</Notice>;
  }

  const pickBracket = entry.bracket === "losers" ? "losers" : "main";
  const weekGames = await getWeekGames(season.id, season.currentWeek);
  // Season-wide: the two-use cap carries over into the losers bracket, so the
  // UI must grey out teams a player already burned in the winners pool.
  const priorPicks = await getEntrySeasonPicks(entry.id);
  const currentPick = await getEntryWeekPick(entry.id, season.currentWeek);

  const locked = !!season.lockAt && new Date() >= new Date(season.lockAt);

  // Usage counts for the 2x rule (exclude this week so re-picking is allowed).
  const usage: Record<string, number> = {};
  for (const p of priorPicks) {
    if (p.week === season.currentWeek) continue;
    usage[p.teamAbbr] = (usage[p.teamAbbr] ?? 0) + 1;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold text-field">
          {season.phase === "playoffs"
            ? "Playoff pick"
            : `Week ${season.currentWeek} pick`}
        </h1>
        <span className="text-sm text-gray-500">
          {pickBracket === "losers" ? "Losers bracket" : "Winners pool"}
        </span>
      </div>

      {season.phase === "playoffs" && (
        <p className="rounded bg-blue-50 px-3 py-2 text-sm text-blue-900">
          Playoffs: the 2-picks-per-team limit is lifted — pick any team.
        </p>
      )}

      <PickPanel
        games={weekGames.map((g) => ({
          id: g.id,
          homeAbbr: g.homeAbbr,
          awayAbbr: g.awayAbbr,
          kickoff: g.kickoff.toISOString(),
          spreadDetail: g.spreadDetail,
          overUnder: g.overUnder != null ? Number(g.overUnder) : null,
        }))}
        usage={usage}
        phase={season.phase as "regular" | "playoffs"}
        currentPick={currentPick?.teamAbbr ?? null}
        locked={locked}
      />
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 p-6 text-center text-gray-700">
      {children}
    </div>
  );
}
