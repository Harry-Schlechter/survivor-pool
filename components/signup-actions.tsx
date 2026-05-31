"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SignupActions({
  joined,
  paid,
  selfMarked,
  signupsOpen,
}: {
  joined: boolean;
  paid: boolean;
  selfMarked: boolean;
  signupsOpen: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function post(url: string) {
    setBusy(true);
    await fetch(url, { method: "POST" });
    setBusy(false);
    router.refresh();
  }

  if (paid) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-green-800">
        ✅ You&apos;re paid and in. Good luck!
      </div>
    );
  }

  if (!joined) {
    if (!signupsOpen) {
      return (
        <div className="rounded-lg border border-gray-200 p-4 text-gray-600">
          Signups are closed for this season.
        </div>
      );
    }
    return (
      <button
        onClick={() => post("/api/signup")}
        disabled={busy}
        className="w-full rounded-lg bg-field px-4 py-3 font-semibold text-white disabled:opacity-50"
      >
        {busy ? "Joining…" : "Join the pool"}
      </button>
    );
  }

  // Joined but not yet paid-confirmed.
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
        You&apos;re signed up. Once you&apos;ve sent the Venmo, mark it below so
        the admin can confirm.
      </div>
      {selfMarked ? (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-blue-800">
          ⏳ Marked as paid — waiting on admin confirmation.
        </div>
      ) : (
        <button
          onClick={() => post("/api/mark-paid")}
          disabled={busy}
          className="w-full rounded-lg bg-field px-4 py-3 font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Saving…" : "I've sent the Venmo"}
        </button>
      )}
    </div>
  );
}
