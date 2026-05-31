import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Magic-link landing: exchange the code for a session, ensure a profile row,
// then redirect to `next` (default dashboard).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") || "/";

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        // Idempotent profile upsert from the auth identity.
        await supabase.from("profiles").upsert(
          {
            id: user.id,
            email: user.email ?? "",
            display_name: user.email?.split("@")[0] ?? "player",
          },
          { onConflict: "id", ignoreDuplicates: true },
        );
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
