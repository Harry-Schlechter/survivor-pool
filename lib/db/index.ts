// Drizzle client over a Neon Postgres connection (DATABASE_URL).
//
// Neon has no row-level security, so EVERY query here runs with full DB
// privilege. All data access must therefore happen server-side (RSC, route
// handlers, server actions, scheduled functions) — never from the browser. The
// browser only talks to /api/* and the Better Auth client. Authorization is
// enforced in lib/auth/guards.ts + per-mutation checks, not in the DB.

import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

const databaseUrl =
  process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "Missing DATABASE_URL (Neon connection string). See .env.local.example.",
  );
}

const sql = neon(databaseUrl);
export const db = drizzle(sql, { schema });

export { schema };
