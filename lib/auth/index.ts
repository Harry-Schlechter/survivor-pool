// Better Auth server instance. Passwordless magic-link sign-in; sessions stored
// in our Neon DB via the Drizzle adapter. Magic-link emails go through the same
// Resend sender used for summaries/reminders.

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { sendEmail } from "@/lib/email/send";
import { magicLinkEmail } from "@/lib/email/templates";
import { env } from "@/lib/env";

export const auth = betterAuth({
  baseURL: env.siteUrl(),
  // Real secret comes from BETTER_AUTH_SECRET. The fallback only keeps module
  // construction from throwing during build/prerender where the env var may be
  // absent; the deployed runtime always sets BETTER_AUTH_SECRET.
  secret:
    process.env.BETTER_AUTH_SECRET ||
    "build-time-placeholder-secret-not-used-at-runtime",
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  // display_name + is_admin live on the user record (no separate profiles table).
  user: {
    additionalFields: {
      displayName: { type: "string", required: false, defaultValue: "" },
      isAdmin: { type: "boolean", required: false, defaultValue: false },
    },
  },
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        const { subject, html } = magicLinkEmail(url);
        await sendEmail({ to: email, subject, html });
      },
    }),
  ],
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refresh daily
  },
});
