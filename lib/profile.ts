// Shared display-name constraints. Kept out of the "use server" action file,
// which may only export async functions.

export const MAX_DISPLAY_NAME = 24;

export type UpdateNameResult = { ok: true } | { ok: false; error: string };
