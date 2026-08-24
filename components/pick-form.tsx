"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { teamName, teamColor } from "@/lib/teams";
import { TeamLogo } from "@/components/team-logo";
import { remainingUses } from "@/lib/picks";
import type { SeasonPhase } from "@/lib/db/schema";

export interface PickGame {
  id: string;
  homeAbbr: string;
  awayAbbr: string;
  kickoff: string;
  spreadDetail: string | null;
  overUnder: number | null;
}

const ERROR_LABELS: Record<string, string> = {
  team_used_max: "You've already used that team twice this season.",
  team_not_in_week: "That team isn't playing this week.",
  locked: "Picks are locked.",
  not_active: "You're not active in the pool.",
  no_active_season: "No active season.",
  not_in_season: "You're not in this season.",
};

export function PickForm({
  games,
  usage,
  phase,
  currentPick,
}: {
  games: PickGame[];
  usage: Record<string, number>;
  phase: SeasonPhase;
  currentPick: string | null;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(currentPick);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Prior-usage array for the shared remainingUses helper.
  const priorList = Object.entries(usage).flatMap(([abbr, n]) =>
    Array(n).fill(abbr),
  );

  async function submit() {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    setSaved(false);
    const res = await fetch("/api/picks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamAbbr: selected }),
    });
    setSubmitting(false);
    if (res.ok) {
      setSaved(true);
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      setError(ERROR_LABELS[body.error] ?? "Could not save pick.");
    }
  }

  function TeamButton({ abbr, side }: { abbr: string; side: "away" | "home" }) {
    const left = remainingUses(abbr, phase, priorList);
    const disabled = left <= 0 && abbr !== currentPick;
    const isSel = selected === abbr;
    const usageLabel =
      phase === "playoffs"
        ? ""
        : disabled
          ? " - used up"
          : left === 1
            ? " - 1 left"
            : " - 2 left";
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setSelected(abbr)}
        style={isSel ? { backgroundColor: teamColor(abbr) } : undefined}
        className={[
          "flex min-h-[68px] flex-1 flex-col items-center justify-center gap-1 rounded-lg border px-2 py-3 text-center transition active:scale-[.98]",
          isSel
            ? "border-transparent text-white"
            : disabled
              ? "cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400"
              : "border-gray-300 hover:border-field",
        ].join(" ")}
      >
        <TeamLogo abbr={abbr} size={28} />
        <span className="text-sm font-semibold leading-tight">
          {teamName(abbr)}
        </span>
        <span className="text-[10px] uppercase tracking-wide opacity-70">
          {side}
          {usageLabel}
        </span>
      </button>
    );
  }

  return (
    <div className="space-y-3">
      {games.map((g) => (
        <div key={g.id} className="rounded-xl border border-gray-200 p-2.5">
          <div className="mb-2 flex items-center justify-between gap-2 px-0.5 text-xs text-gray-500">
            <span className="font-medium">{formatKick(g.kickoff)}</span>
            {g.spreadDetail || g.overUnder != null ? (
              <span className="rounded bg-gray-100 px-2 py-0.5 font-medium text-gray-600">
                {g.spreadDetail ? `Line ${g.spreadDetail}` : ""}
                {g.spreadDetail && g.overUnder != null ? " | " : ""}
                {g.overUnder != null ? `O/U ${g.overUnder}` : ""}
              </span>
            ) : (
              <span className="text-gray-300">line TBD</span>
            )}
          </div>
          <div className="flex items-stretch gap-2">
            <TeamButton abbr={g.awayAbbr} side="away" />
            <span className="self-center text-xs font-medium text-gray-400">
              @
            </span>
            <TeamButton abbr={g.homeAbbr} side="home" />
          </div>
        </div>
      ))}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-green-600">Pick saved!</p>}

      {/* Sticky submit so it's always reachable on a long mobile list. */}
      <div className="sticky bottom-3 pt-1">
        <button
          onClick={submit}
          disabled={!selected || submitting}
          className="w-full rounded-lg bg-field px-4 py-3.5 text-base font-semibold text-white shadow-lg disabled:opacity-50"
        >
          {submitting
            ? "Saving..."
            : selected
              ? `Lock in ${teamName(selected)}`
              : "Select a team"}
        </button>
      </div>
    </div>
  );
}

function formatKick(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  });
}
