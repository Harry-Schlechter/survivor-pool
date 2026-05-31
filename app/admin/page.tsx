import { requireAdmin, getCurrentSeason } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { Nav } from "@/components/nav";
import {
  createSeason,
  updateSeasonSettings,
  setStatus,
  setPhase,
  confirmPaid,
  syncAndGrade,
  nextWeek,
  refreshLock,
  completeSeason,
  archiveSeason,
} from "./actions";

export default async function AdminPage() {
  const profile = await requireAdmin();
  const season = await getCurrentSeason();
  const admin = createAdminClient();

  // Hand-authored types don't model the profiles embed (it resolves to a
  // SelectQueryError), so read the raw data and re-type via unknown.
  type AdminEntry = {
    id: string;
    paid: boolean;
    paid_marked_by_user: boolean;
    bracket: string;
    profiles:
      | { display_name: string; email: string }
      | { display_name: string; email: string }[]
      | null;
  };
  let entries: AdminEntry[] = [];
  if (season) {
    const res = await admin
      .from("entries")
      .select(
        "id,paid,paid_marked_by_user,bracket,user_id,profiles(display_name,email)",
      )
      .eq("season_id", season.id)
      .order("joined_at", { ascending: true });
    entries = (res.data ?? []) as unknown[] as AdminEntry[];
  }

  return (
    <div className="min-h-screen">
      <Nav isAdmin userId={profile.id} />
      <main className="mx-auto max-w-3xl space-y-8 px-4 py-6">
        <h1 className="text-2xl font-bold text-field">Admin</h1>

        {!season ? (
          <CreateSeasonForm />
        ) : (
          <>
            <SeasonControls season={season} />
            <PaymentTable entries={entries} />
            <DangerZone seasonId={season.id} status={season.status} />
            <CreateSeasonForm />
          </>
        )}
      </main>
    </div>
  );
}

function CreateSeasonForm() {
  return (
    <section className="rounded-lg border border-gray-200 p-5">
      <h2 className="mb-3 font-semibold">Create a season</h2>
      <form action={createSeason} className="grid grid-cols-2 gap-3">
        <Input name="year" label="Year" type="number" defaultValue="2026" />
        <Input name="buy_in" label="Buy-in ($)" type="number" defaultValue="50" />
        <Input name="venmo_handle" label="Venmo handle" placeholder="@your-handle" />
        <Input name="venmo_link" label="Venmo link" placeholder="https://venmo.com/..." />
        <button className="col-span-2 rounded bg-field px-4 py-2 font-semibold text-white">
          Create (opens signups)
        </button>
      </form>
    </section>
  );
}

function SeasonControls({
  season,
}: {
  season: {
    id: string;
    year: number;
    status: string;
    phase: string;
    current_week: number;
    lock_at: string | null;
    buy_in: number;
    venmo_handle: string | null;
    venmo_link: string | null;
  };
}) {
  return (
    <section className="space-y-4 rounded-lg border border-gray-200 p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">
          {season.year} season — <span className="capitalize">{season.status}</span>{" "}
          · {season.phase} · week {season.current_week}
        </h2>
      </div>

      <div className="text-sm text-gray-600">
        Lock:{" "}
        {season.lock_at
          ? new Date(season.lock_at).toLocaleString("en-US", {
              timeZone: "America/New_York",
            }) + " ET"
          : "not set"}
      </div>

      {/* Lifecycle buttons */}
      <div className="flex flex-wrap gap-2">
        {season.status === "signup" && (
          <ActionButton action={setStatus.bind(null, season.id, "active")}>
            Open season (signup → active)
          </ActionButton>
        )}
        {season.status === "active" && (
          <>
            <ActionButton action={syncAndGrade}>Sync + grade now</ActionButton>
            <ActionButton action={refreshLock}>Refresh lock time</ActionButton>
            <ActionButton action={nextWeek}>Advance to next week</ActionButton>
            {season.phase === "regular" ? (
              <ActionButton action={setPhase.bind(null, season.id, "playoffs")}>
                Start playoffs
              </ActionButton>
            ) : (
              <ActionButton action={setPhase.bind(null, season.id, "regular")}>
                Back to regular
              </ActionButton>
            )}
            <ActionButton action={completeSeason} variant="danger">
              Complete season
            </ActionButton>
          </>
        )}
      </div>

      {/* Settings */}
      <form action={updateSeasonSettings} className="grid grid-cols-2 gap-3 border-t pt-4">
        <input type="hidden" name="season_id" value={season.id} />
        <Input name="buy_in" label="Buy-in ($)" type="number" defaultValue={String(season.buy_in)} />
        <Input name="venmo_handle" label="Venmo handle" defaultValue={season.venmo_handle ?? ""} />
        <Input name="venmo_link" label="Venmo link" defaultValue={season.venmo_link ?? ""} />
        <button className="col-span-2 rounded border border-field px-4 py-2 font-semibold text-field">
          Save settings
        </button>
      </form>
    </section>
  );
}

function PaymentTable({
  entries,
}: {
  entries: {
    id: string;
    paid: boolean;
    paid_marked_by_user: boolean;
    bracket: string;
    profiles: { display_name: string; email: string } | { display_name: string; email: string }[] | null;
  }[];
}) {
  return (
    <section className="rounded-lg border border-gray-200 p-5">
      <h2 className="mb-3 font-semibold">
        Players ({entries.length}) — confirm payments
      </h2>
      <div className="overflow-hidden rounded border border-gray-100">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2">Player</th>
              <th className="px-3 py-2">Self-marked</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => {
              const prof = Array.isArray(e.profiles) ? e.profiles[0] : e.profiles;
              return (
                <tr key={e.id} className="border-t border-gray-100">
                  <td className="px-3 py-2">
                    {prof?.display_name}
                    <div className="text-xs text-gray-400">{prof?.email}</div>
                  </td>
                  <td className="px-3 py-2">
                    {e.paid_marked_by_user ? "✅" : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {e.paid ? (
                      <span className="text-green-700">Paid</span>
                    ) : (
                      <span className="text-amber-700">Unpaid</span>
                    )}{" "}
                    · {e.bracket}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <ActionButton
                      action={confirmPaid.bind(null, e.id, !e.paid)}
                      small
                    >
                      {e.paid ? "Mark unpaid" : "Confirm paid"}
                    </ActionButton>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DangerZone({
  seasonId,
  status,
}: {
  seasonId: string;
  status: string;
}) {
  if (status !== "complete") return null;
  return (
    <section className="rounded-lg border border-red-200 bg-red-50 p-5">
      <h2 className="mb-2 font-semibold text-red-800">Archive</h2>
      <p className="mb-3 text-sm text-red-700">
        Season is complete. Archive it to make room for next year (history stays
        readable on profiles).
      </p>
      <ActionButton action={archiveSeason.bind(null, seasonId)} variant="danger">
        Archive season
      </ActionButton>
    </section>
  );
}

// --- small UI helpers ------------------------------------------------------

function Input({
  name,
  label,
  type = "text",
  defaultValue,
  placeholder,
}: {
  name: string;
  label: string;
  type?: string;
  defaultValue?: string;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-gray-600">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        step="any"
        className="w-full rounded border border-gray-300 px-3 py-2"
      />
    </label>
  );
}

function ActionButton({
  action,
  children,
  variant,
  small,
}: {
  action: () => Promise<void>;
  children: React.ReactNode;
  variant?: "danger";
  small?: boolean;
}) {
  return (
    <form action={action}>
      <button
        className={[
          "rounded font-semibold",
          small ? "px-2 py-1 text-xs" : "px-4 py-2 text-sm",
          variant === "danger"
            ? "bg-red-600 text-white"
            : "border border-field text-field",
        ].join(" ")}
      >
        {children}
      </button>
    </form>
  );
}
