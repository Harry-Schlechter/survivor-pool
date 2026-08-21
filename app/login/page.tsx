"use client";

import { useState } from "react";
import { signIn } from "@/lib/auth/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const next =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("next") || "/"
        : "/";
    const { error } = await signIn.magicLink({ email, callbackURL: next });
    setLoading(false);
    if (error) setError(error.message ?? "Could not send link.");
    else setSent(true);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="mb-2 text-3xl font-bold text-field">
        🏈 Jim Olah Survivor Pool
      </h1>
      <p className="mb-2 text-gray-600">
        Sign in with a magic link — no password needed.
      </p>
      <p className="mb-8 text-sm text-gray-500">
        The link arrives by email — if it&apos;s not there in a minute, check
        your spam or junk folder.
      </p>

      {sent ? (
        <div className="space-y-3">
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-green-800">
            Check your email for a sign-in link. You can close this tab.
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <strong>Don&apos;t see it?</strong> Check your{" "}
            <strong>spam or junk folder</strong> — sign-in links often land
            there, especially on AOL, Yahoo and Hotmail. Mark it{" "}
            <em>not spam</em> so future pool emails reach your inbox.
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-field focus:outline-none focus:ring-1 focus:ring-field"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-field px-4 py-3 font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Sending…" : "Send magic link"}
          </button>
        </form>
      )}

      <a
        href="/rules"
        className="mt-8 text-center text-sm text-gray-500 underline"
      >
        How the pool works →
      </a>
    </main>
  );
}
