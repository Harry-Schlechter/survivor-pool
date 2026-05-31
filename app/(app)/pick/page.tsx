import { requireUser, getCurrentSeason, getMyEntry } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PickForm } from "@/components/pick-form";
import Link from "next/link";

export default async function PickPage() {
  const { user } = await requireUser();
  const season = await getCurrentSeason();

  if (!season || season.status !== "active") {
    return <Notice>No week is open for picks right now.</Notice>;
  }

  const entry = await getMyEntry(season.id, user.id);
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
  if (!entry.paid) {
    return (
      <Notice>
        Your entry isn&apos;t marked paid yet, so you can&apos;t pick. Send the
        buy-in and confirm on the{" "}
        <Link href="/signup" className="underline">
          signup page
        </Link>
        .
      </Notice>
    );
  }
  if (entry.bracket === "eliminated") {
    return <Notice>You&apos;ve been eliminated — no more picks. ☠️</Notice>;
  }

  const supabase = createClient();
  const pickBracket = entry.bracket === "losers" ? "losers" : "main";

  const { data: games } = await supabase
    .from("games")
    .select("*")
    .eq("season_id", season.id)
    .eq("week", season.current_week)
    .order("kickoff", { ascending: true });

  const { data: priorPicks } = await supabase
    .from("picks")
    .select("team_abbr,week,bracket")
    .eq("entry_id", entry.id)
    .eq("bracket", pickBracket);

  const { data: currentPick } = await supabase
    .from("picks")
    .select("team_abbr")
    .eq("entry_id", entry.id)
    .eq("week", season.current_week)
    .maybeSingle();

  const locked = !!season.lock_at && new Date() >= new Date(season.lock_at);

  // Usage counts for the 2x rule (exclude this week so re-picking is allowed).
  const usage: Record<string, number> = {};
  for (const p of priorPicks ?? []) {
    if (p.week === season.current_week) continue;
    usage[p.team_abbr] = (usage[p.team_abbr] ?? 0) + 1;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold text-field">
          {season.phase === "playoffs"
            ? "Playoff pick"
            : `Week ${season.current_week} pick`}
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

      {locked ? (
        <Notice>Picks are locked for this week. ⏰</Notice>
      ) : (
        <PickForm
          games={(games ?? []).map((g) => ({
            id: g.id,
            homeAbbr: g.home_abbr,
            awayAbbr: g.away_abbr,
            kickoff: g.kickoff,
            spreadDetail: g.spread_detail,
            overUnder: g.over_under,
          }))}
          usage={usage}
          phase={season.phase}
          currentPick={currentPick?.team_abbr ?? null}
        />
      )}
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
