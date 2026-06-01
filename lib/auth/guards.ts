// Server-side auth/session helpers. Replace the old lib/auth.ts (Supabase).
// These read the Better Auth session from request headers and enforce access.

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { user as userTable } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { UserRow } from "@/lib/db/schema";

/** Current authenticated user (Better Auth session user) or null. */
export async function getSessionUser() {
  const session = await auth.api.getSession({ headers: headers() });
  return session?.user ?? null;
}

/** Require a signed-in user or redirect to /login. Returns the full DB user row. */
export async function requireUser(): Promise<UserRow> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect("/login");

  const rows = await db
    .select()
    .from(userTable)
    .where(eq(userTable.id, sessionUser.id))
    .limit(1);
  if (!rows[0]) redirect("/login");
  return rows[0];
}

/** Require an admin or redirect home. */
export async function requireAdmin(): Promise<UserRow> {
  const u = await requireUser();
  if (!u.isAdmin) redirect("/");
  return u;
}
