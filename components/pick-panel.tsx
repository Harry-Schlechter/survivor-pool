"use client";

import { useState } from "react";
import { PickForm, type PickGame } from "@/components/pick-form";
import { PickConfirmation } from "@/components/pick-confirmation";

/**
 * Chooses between the confirmation card and the picker.
 *
 * Once you have a pick we show the confirmation rather than the full grid, so
 * the page answers "who did I take?" at a glance. "Change pick" reopens the
 * grid, and is never rendered after lock.
 */
export function PickPanel({
  games,
  usage,
  phase,
  currentPick,
  locked,
}: {
  games: PickGame[];
  usage: Record<string, number>;
  phase: "regular" | "playoffs";
  currentPick: string | null;
  locked: boolean;
}) {
  const [editing, setEditing] = useState(false);

  if (locked && !currentPick) {
    return (
      <div className="rounded-lg border border-gray-200 p-6 text-center text-gray-700">
        Picks are locked and you didn\u2019t get one in this week. \u23f0
      </div>
    );
  }

  if (currentPick && !editing) {
    const game = games.find(
      (g) => g.homeAbbr === currentPick || g.awayAbbr === currentPick,
    );
    const isHome = game?.homeAbbr === currentPick;
    const opponent = game
      ? isHome
        ? game.awayAbbr
        : game.homeAbbr
      : null;

    return (
      <PickConfirmation
        teamAbbr={currentPick}
        opponentAbbr={opponent}
        isHome={isHome}
        kickoff={game?.kickoff ?? null}
        locked={locked}
        onChange={
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-lg border border-field bg-white px-4 py-2 text-sm font-semibold text-field transition hover:bg-field hover:text-white"
          >
            Change pick
          </button>
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      {currentPick && (
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="text-sm text-gray-500 underline hover:text-field"
        >
          \u2190 Keep my current pick
        </button>
      )}
      <PickForm
        games={games}
        usage={usage}
        phase={phase}
        currentPick={currentPick}
      />
    </div>
  );
}
