// Promote a user to admin by email. Run after they've signed in once (so their
// row exists in the `user` table).
//
//   node scripts/make-admin.mjs you@example.com

import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

try {
  const envFile = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  for (const line of envFile.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {
  /* rely on ambient env */
}

const email = process.argv[2];
if (!email) {
  console.error("Usage: node scripts/make-admin.mjs <email>");
  process.exit(1);
}

const url = process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL;
if (!url) {
  console.error("Missing DATABASE_URL.");
  process.exit(1);
}
const sql = neon(url);

const rows = await sql`update "user" set is_admin = true where email = ${email} returning id, email`;
if (rows.length === 0) {
  console.error(`No user with email ${email}. Have them sign in once first.`);
  process.exit(1);
}
console.log(`✅ ${rows[0].email} is now an admin.`);
