// Centralized env access with friendly errors. Public vars are inlined by Next
// at build time; server-only vars are read at runtime.

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. See .env.local.example.`,
    );
  }
  return value;
}

export const env = {
  databaseUrl: () =>
    required(
      "DATABASE_URL",
      process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL,
    ),
  betterAuthSecret: () =>
    required("BETTER_AUTH_SECRET", process.env.BETTER_AUTH_SECRET),
  resendApiKey: () => required("RESEND_API_KEY", process.env.RESEND_API_KEY),
  emailFrom: () =>
    process.env.EMAIL_FROM || "Survivor Pool <onboarding@resend.dev>",
  // Trailing slash is stripped: callers append paths ("/pick"), and a stored
  // value ending in "/" would otherwise yield "//pick" and break the Better
  // Auth callback origin match.
  siteUrl: () =>
    (
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.BETTER_AUTH_URL ||
      "http://localhost:3000"
    ).replace(/\/+$/, ""),
  cronSecret: () => required("CRON_SECRET", process.env.CRON_SECRET),
};
