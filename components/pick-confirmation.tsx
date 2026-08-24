import { TeamLogo } from "@/components/team-logo";
import { teamName } from "@/lib/teams";

/**
 * Post-pick confirmation. Shows who you locked in, who they play, and when —
 * plus a "Change pick" affordance that disappears once the week locks.
 */
export function PickConfirmation({
  teamAbbr,
  opponentAbbr,
  isHome,
  kickoff,
  locked,
  onChange,
}: {
  teamAbbr: string;
  opponentAbbr: string | null;
  isHome: boolean;
  kickoff: string | null;
  locked: boolean;
  /** Rendered as the "Change pick" control; omitted when locked. */
  onChange?: React.ReactNode;
}) {
  const kick = kickoff
    ? new Date(kickoff).toLocaleString("en-US", {
        timeZone: "America/New_York",
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
      })
    : null;

  return (
    <div className="rounded-xl border border-green-200 bg-green-50 p-5">
      <p className="text-sm font-semibold uppercase tracking-wide text-green-700">
        {locked ? "Your pick is locked" : "You\u2019re locked in"}
      </p>

      <div className="mt-3 flex items-center gap-3">
        <TeamLogo abbr={teamAbbr} size={48} />
        <div className="min-w-0">
          <p className="text-xl font-bold leading-tight text-field">
            {teamName(teamAbbr)}
          </p>
          {opponentAbbr && (
            <p className="flex flex-wrap items-center gap-1.5 text-sm text-gray-600">
              <span>{isHome ? "vs" : "@"}</span>
              <TeamLogo abbr={opponentAbbr} size={16} />
              <span>{teamName(opponentAbbr)}</span>
            </p>
          )}
        </div>
      </div>

      {kick && <p className="mt-3 text-sm text-gray-600">Kickoff {kick}</p>}

      {locked ? (
        <p className="mt-4 text-sm text-gray-600">
          Picks are locked for this week \u2014 everyone\u2019s picks are now
          visible on the home page. Good luck. \ud83c\udf40
        </p>
      ) : (
        onChange && <div className="mt-4">{onChange}</div>
      )}
    </div>
  );
}
