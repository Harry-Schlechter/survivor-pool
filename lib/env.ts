// Centralized env access with friendly errors. Public vars are inlined by Next
// at build time; server-only vars are read at runtime.

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `See .env.local.example.`,
    );
  }
  return value;
}

export const env = {
  supabaseUrl: () =>
    required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: () =>
    required(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    ),
  supabaseServiceRoleKey: () =>
    required(
      "SUPABASE_SERVICE_ROLE_KEY",
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    ),
  resendApiKey: () => required("RESEND_API_KEY", process.env.RESEND_API_KEY),
  emailFrom: () =>
    process.env.EMAIL_FROM || "Survivor Pool <onboarding@resend.dev>",
  siteUrl: () => process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  cronSecret: () => required("CRON_SECRET", process.env.CRON_SECRET),
};
