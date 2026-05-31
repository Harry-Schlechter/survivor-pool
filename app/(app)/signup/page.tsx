import { requireUser, getCurrentSeason, getMyEntry } from "@/lib/auth";
import { SignupActions } from "@/components/signup-actions";

export default async function SignupPage() {
  const { user } = await requireUser();
  const season = await getCurrentSeason();

  if (!season) {
    return <Notice>No season is open right now.</Notice>;
  }

  const entry = await getMyEntry(season.id, user.id);
  const signupsOpen = season.status === "signup";

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <h1 className="text-2xl font-bold text-field">
        {season.year} Survivor Pool
      </h1>

      <div className="rounded-lg border border-gray-200 p-5">
        <h2 className="mb-2 font-semibold">Buy-in: ${season.buy_in}</h2>
        {season.venmo_link || season.venmo_handle ? (
          <p className="text-sm text-gray-700">
            Pay via Venmo:{" "}
            {season.venmo_link ? (
              <a
                href={season.venmo_link}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-field underline"
              >
                {season.venmo_handle || "Open Venmo"}
              </a>
            ) : (
              <span className="font-semibold">{season.venmo_handle}</span>
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
        selfMarked={!!entry?.paid_marked_by_user}
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
