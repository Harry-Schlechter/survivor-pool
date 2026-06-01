import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

// Better Auth mounts all its endpoints (sign-in, magic-link verify, session,
// sign-out, callbacks) under /api/auth/*.
export const { GET, POST } = toNextJsHandler(auth);
