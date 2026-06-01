import { db } from "@/lib/db";
import { messages, user } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export interface SmackMessage {
  id: string;
  body: string;
  createdAt: string; // ISO
  displayName: string;
  userId: string;
}

/** Most-recent messages first (the panel reverses to show newest at the bottom). */
export async function getRecentMessages(limit = 100): Promise<SmackMessage[]> {
  const rows = await db
    .select({
      id: messages.id,
      body: messages.body,
      createdAt: messages.createdAt,
      userId: messages.userId,
      displayName: user.displayName,
      name: user.name,
      email: user.email,
    })
    .from(messages)
    .innerJoin(user, eq(messages.userId, user.id))
    .orderBy(desc(messages.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    body: r.body,
    createdAt: r.createdAt.toISOString(),
    userId: r.userId,
    displayName: r.displayName || r.name || r.email.split("@")[0] || "player",
  }));
}

export async function postMessage(userId: string, body: string) {
  const trimmed = body.trim().slice(0, 1000);
  if (!trimmed) return;
  await db.insert(messages).values({ userId, body: trimmed });
}
