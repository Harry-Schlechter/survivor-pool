import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { env } from "@/lib/env";

// Service-role client — BYPASSES RLS. Use ONLY in trusted server contexts:
// Netlify scheduled functions and admin/cron route handlers. Never import this
// into a "use client" module.
export function createAdminClient() {
  return createSupabaseClient<Database>(
    env.supabaseUrl(),
    env.supabaseServiceRoleKey(),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
