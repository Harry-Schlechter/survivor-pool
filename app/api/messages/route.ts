import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/guards";
import { getRecentMessages, postMessage } from "@/lib/queries/messages";

// GET: recent messages (oldest-first for chat display).
// POST: add a message as the signed-in user. Anyone signed in can post.
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const messages = (await getRecentMessages()).reverse(); // oldest -> newest
  return NextResponse.json({ messages });
}

const Body = z.object({ body: z.string().min(1).max(1000) });

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  await postMessage(user.id, parsed.data.body);
  const messages = (await getRecentMessages()).reverse();
  return NextResponse.json({ ok: true, messages });
}
