"use client";

import { useActionState, useEffect, useState } from "react";
import { updateDisplayName } from "@/app/(app)/profile/actions";
import { MAX_DISPLAY_NAME, type UpdateNameResult } from "@/lib/profile";

export function DisplayNameForm({
  current,
  startOpen = false,
}: {
  current: string;
  /** Open the editor immediately — used when the player has no name yet. */
  startOpen?: boolean;
}) {
  const [open, setOpen] = useState(startOpen);
  const [state, formAction, pending] = useActionState<
    UpdateNameResult | null,
    FormData
  >(updateDisplayName, null);

  // Close the editor once a save succeeds. In an effect, not during render —
  // setting state while rendering warns and can loop.
  useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm text-gray-500 underline hover:text-field"
      >
        {current ? "Edit name" : "Set your name"}
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input
        name="display_name"
        defaultValue={current}
        maxLength={MAX_DISPLAY_NAME}
        required
        autoFocus
        aria-label="Display name"
        className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-base focus:border-field focus:outline-none focus:ring-1 focus:ring-field"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-field px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="px-2 py-2 text-sm text-gray-500 underline"
      >
        Cancel
      </button>
      {state && !state.ok && (
        <p className="w-full text-sm text-red-600">{state.error}</p>
      )}
    </form>
  );
}
