// Shared guard for the /api/cron/* routes. These replace Netlify Scheduled
// Functions, whose trigger mechanism silently stopped firing on this site —
// registration and manual "Run now" both worked, but zero invocations ever
// occurred on schedule (verified via the notifications table and
// games.updated_at staying frozen for 18+ days across two deploys). An
// external scheduler (GitHub Actions) now calls these routes directly over
// HTTP with a shared secret, so there's a real, readable execution log
// outside of Netlify's opaque scheduler.

import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";

/**
 * Require the Authorization: Bearer <CRON_SECRET> header. Returns a 401
 * response to return early with, or null if the request is authorized.
 */
export function requireCronSecret(request: NextRequest): NextResponse | null {
  const auth = request.headers.get("authorization");
  const expected = `Bearer ${env.cronSecret()}`;
  if (auth !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}
