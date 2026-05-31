"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { teamName, teamColor } from "@/lib/teams";
import { remainingUses } from "@/lib/picks";
import type { SeasonPhase } from "@/lib/database.types";

interface GameLite {
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
  not_paid: "Your entry isn't marked paid.",
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
  games: GameLite[];
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

  function TeamButton({ abbr }: { abbr: string }) {
    const left = remainingUses(abbr, phase, priorList);
    const disabled = left <= 0 && abbr !== currentPick;
    const isSel = selected === abbr;
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setSelected(abbr)}
        style={isSel ? { backgroundColor: teamColor(abbr) } : undefined}
        className={[
          "flex flex-1 flex-col items-center rounded-lg border px-3 py-3 transition",
          isSel
            ? "border-transparent text-white"
            : disabled
              ? "cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400"
              : "border-gray-300 hover:border-field",
        ].join(" ")}
      >
        <span className="font-semibold">{teamName(abbr)}</span>
        <span className="text-xs opacity-80">
          {phase === "playoffs"
            ? " "
            : disabled
              ? "used 2×"
              : left === 1
                ? "1 use left"
                : "2 uses left"}
        </span>
      </button>
    );
  }

  return (
    <div className="space-y-3">
      {games.map((g) => (
        <div key={g.id} className="rounded-lg border border-gray-100 p-2">
          <div className="mb-1 flex items-center justify-between px-1 text-xs text-gray-500">
            <span>{formatKick(g.kickoff)}</span>
            {(g.spreadDetail || g.overUnder) && (
              <span>
                {g.spreadDetail}
                {g.spreadDetail && g.overUnder ? " · " : ""}
                {g.overUnder ? `O/U ${g.overUnder}` : ""}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <TeamButton abbr={g.awayAbbr} />
            <span className="self-center text-xs text-gray-400">@</span>
            <TeamButton abbr={g.homeAbbr} />
          </div>
        </div>
      ))}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-green-600">Pick saved! ✅</p>}

      <button
        onClick={submit}
        disabled={!selected || submitting}
        className="w-full rounded-lg bg-field px-4 py-3 font-semibold text-white disabled:opacity-50"
      >
        {submitting
          ? "Saving…"
          : selected
            ? `Lock in ${teamName(selected)}`
            : "Select a team"}
      </button>
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
