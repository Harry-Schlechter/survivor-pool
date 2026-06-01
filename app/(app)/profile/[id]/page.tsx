import { requireUser } from "@/lib/auth/guards";
import { getProfile, getCareerData } from "@/lib/queries/profile";
import { computeCareerStats } from "@/lib/stats";
import { teamName } from "@/lib/teams";

export default async function ProfilePage({
  params,
}: {
  params: { id: string };
}) {
  await requireUser();

  const profile = await getProfile(params.id);
  if (!profile) {
    return <div className="text-gray-600">Player not found.</div>;
  }

  const { entries, picks } = await getCareerData(params.id);
  const stats = computeCareerStats(entries, picks);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-field">{profile.displayName}</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Seasons" value={stats.seasonsPlayed} />
        <Stat label="Record" value={`${stats.wins}–${stats.losses}`} />
        <Stat
          label="Win streak"
          value={stats.currentStreak > 0 ? `🔥 ${stats.currentStreak}` : "0"}
        />
        <Stat
          label="Fav team"
          value={
            stats.mostPickedTeam
              ? `${teamName(stats.mostPickedTeam.abbr)} (${stats.mostPickedTeam.count})`
              : "—"
          }
        />
        <Stat label="Avg elim week" value={stats.avgEliminationWeek ?? "—"} />
        <Stat label="Avg finish" value={stats.avgFinalRank ?? "—"} />
        <Stat
          label="Best finish"
          value={stats.bestFinish ? `#${stats.bestFinish}` : "—"}
        />
        <Stat label="Total picks" value={stats.totalPicks} />
      </div>

      <PickHistory picks={picks} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <div className="text-xs uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

function PickHistory({
  picks,
}: {
  picks: { season_id: string; week: number; team_abbr: string; result: string }[];
}) {
  if (picks.length === 0) return null;
  const sorted = [...picks].sort(
    (a, b) => b.season_id.localeCompare(a.season_id) || a.week - b.week,
  );
  return (
    <section>
      <h2 className="mb-2 text-lg font-semibold">Pick history</h2>
      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-2">Week</th>
              <th className="px-4 py-2">Team</th>
              <th className="px-4 py-2">Result</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, i) => (
              <tr key={i} className="border-t border-gray-100">
                <td className="px-4 py-2">{p.week}</td>
                <td className="px-4 py-2">{teamName(p.team_abbr)}</td>
                <td className="px-4 py-2">
                  {p.result === "win"
                    ? "✅ Win"
                    : p.result === "loss"
                      ? "❌ Loss"
                      : "• Pending"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
