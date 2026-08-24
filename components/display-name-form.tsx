"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateDisplayName } from "@/app/(app)/profile/actions";
import { MAX_DISPLAY_NAME } from "@/lib/profile";

/**
 * Inline display-name editor.
 *
 * Uses plain useState and calls the server action directly, rather than
 * useActionState — this project is on React 18, where that hook (and
 * useFormState / useFormStatus) does not exist.
 */
export function DisplayNameForm({
  current,
  startOpen = false,
}: {
  current: string;
  /** Open the editor immediately — used when the player has no name yet. */
  startOpen?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(startOpen);
  const [value, setValue] = useState(current);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const fd = new FormData();
    fd.set("display_name", value);

    try {
      const result = await updateDisplayName(null, fd);
      if (result.ok) {
        setOpen(false);
        router.refresh(); // re-render server components with the new name
      } else {
        setError(result.error);
      }
    } catch {
      setError("Couldn't save. Try again.");
    } finally {
      setPending(false);
    }
  }

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
    <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2">
      <input
        name="display_name"
        value={value}
        onChange={(e) => setValue(e.target.value)}
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
        onClick={() => {
          setValue(current);
          setError(null);
          setOpen(false);
        }}
        className="px-2 py-2 text-sm text-gray-500 underline"
      >
        Cancel
      </button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </form>
  );
}
