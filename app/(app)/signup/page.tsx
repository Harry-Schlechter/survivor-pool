import { requireUser } from "@/lib/auth/guards";
import { getCurrentSeason, getEntry } from "@/lib/queries/seasons";
import { SignupActions } from "@/components/signup-actions";

export default async function SignupPage() {
  const user = await requireUser();
  const season = await getCurrentSeason();

  if (!season) {
    return <Notice>No season is open right now.</Notice>;
  }

  const entry = await getEntry(season.id, user.id);
  const signupsOpen = season.status === "signup";

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <h1 className="text-2xl font-bold text-field">
        {season.year} Jim Olah Survivor Pool
      </h1>

      <div className="rounded-lg border border-gray-200 p-5">
        <h2 className="mb-2 font-semibold">Buy-in: ${season.buyIn}</h2>
        {season.venmoLink || season.venmoHandle ? (
          <p className="text-sm text-gray-700">
            Pay via Venmo:{" "}
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
        ) : (
          <p className="text-sm text-gray-500">
            Payment details will be posted soon.
          </p>
        )}
        <p className="mt-2 text-xs text-gray-500">
          Include your name in the Venmo note. The admin confirms each payment.
        </p>
      </div>

      <SignupActions
        joined={!!entry}
        paid={!!entry?.paid}
        selfMarked={!!entry?.paidMarkedByUser}
        signupsOpen={signupsOpen}
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
