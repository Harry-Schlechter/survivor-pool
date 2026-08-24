import { requireUser } from "@/lib/auth/guards";
import { getCurrentSeason, getEntry, signupsOpen } from "@/lib/queries/seasons";
import { SignupActions } from "@/components/signup-actions";
import { DisplayNameForm } from "@/components/display-name-form";

export default async function SignupPage() {
  const user = await requireUser();
  const season = await getCurrentSeason();

  if (!season) {
    return <Notice>No season is open right now.</Notice>;
  }

  const entry = await getEntry(season.id, user.id);
  const canJoin = signupsOpen(season);

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <h1 className="text-2xl font-bold text-field">
        {season.year} Jim Olah Survivor Pool
      </h1>

      <div className="rounded-lg border border-gray-200 p-5">
        <h2 className="mb-2 font-semibold">Buy-in: ${season.buyIn}</h2>
        {season.venmoLink || season.venmoHandle ? (
          <div className="space-y-1.5 text-sm text-gray-700">
            <p>Pay Lou after you sign up — either way works:</p>
            <p>
              <span className="text-gray-500">Venmo</span>{" "}
              {season.venmoLink ? (
                <a
                  href={season.venmoLink}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-field underline"
                >
                  {season.venmoHandle || "Open Venmo"}
                </a>
              ) : (
                <span className="font-semibold">{season.venmoHandle}</span>
              )}
            </p>
            <p>
              <span className="text-gray-500">or</span>{" "}
              <span className="font-semibold">cash in person</span>
            </p>
          </div>
        ) : (
          <p className="text-sm text-gray-500">
            Payment details will be posted soon.
          </p>
        )}
        <p className="mt-3 text-xs text-gray-500">
          Include your name in the Venmo note. Lou marks you as paid once he has
          it — you can make your picks right away without waiting.
        </p>
      </div>

      {/* New accounts start with no display name, which would show as
          "Unnamed player" in the standings and in the weekly recap emails.
          Prompt for one here, where everyone passes through on the way in. */}
      <div className="rounded-lg border border-gray-200 p-5">
        <h2 className="mb-1 font-semibold">
          {user.displayName ? "Your name in the pool" : "Pick a display name"}
        </h2>
        <p className="mb-3 text-sm text-gray-600">
          {user.displayName
            ? "This is how you appear in the standings and weekly emails."
            : "This is how you'll appear in the standings and weekly emails."}
        </p>
        {user.displayName ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-semibold text-field">
              {user.displayName}
            </span>
            <DisplayNameForm current={user.displayName} />
          </div>
        ) : (
          <DisplayNameForm current="" startOpen />
        )}
      </div>

      <SignupActions
        joined={!!entry}
        paid={!!entry?.paid}
        selfMarked={!!entry?.paidMarkedByUser}
        signupsOpen={canJoin}
      />
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 p-6 text-center text-gray-700">
      {children}
    </div>
  );
}
