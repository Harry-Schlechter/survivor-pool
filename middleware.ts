import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Lightweight gate: check for a Better Auth session cookie and redirect
// unauthenticated users away from protected routes. Full session validation
// happens in server components via requireUser(); this is just the fast
// edge-level redirect (Better Auth recommends cookie-presence checks here
// rather than DB calls).
export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  // /how-it-works is the public copy of the rules (linked from the login page).
  // /rules is the in-app tab and lives behind auth with the rest of the shell.
  const isPublic =
    path === "/login" ||
    path.startsWith("/auth") ||
    path === "/how-it-works";

  if (isPublic) return NextResponse.next();

  const sessionCookie = getSessionCookie(request);
  if (!sessionCookie) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
