"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { user as userTable } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { MAX_DISPLAY_NAME, type UpdateNameResult } from "@/lib/profile";

// Control chars would break the plain-text parts of the email templates and
// can be used to spoof names in the standings list.
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]/;

/**
 * Rename yourself. Always writes to the *session* user's row — the id is never
 * taken from the client, so this can't be used to rename someone else.
 */
export async function updateDisplayName(
  _prev: UpdateNameResult | null,
  formData: FormData,
): Promise<UpdateNameResult> {
  const me = await requireUser();

  // Collapse internal whitespace runs so names can't be padded for fake
  // alignment or made to look like another player's.
  const raw = String(formData.get("display_name") ?? "");
  const name = raw.trim().replace(/\s+/g, " ");

  if (name.length === 0) {
    return { ok: false, error: "Name can't be empty." };
  }
  if (name.length > MAX_DISPLAY_NAME) {
    return { ok: false, error: `Keep it to ${MAX_DISPLAY_NAME} characters.` };
  }
  if (CONTROL_CHARS.test(name)) {
    return { ok: false, error: "Name contains invalid characters." };
  }

  await db
    .update(userTable)
    .set({ displayName: name, name, updatedAt: new Date() })
    .where(eq(userTable.id, me.id));

  revalidatePath(`/profile/${me.id}`);
  revalidatePath("/");
  return { ok: true };
}
