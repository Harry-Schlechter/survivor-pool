"use client";

import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth/client";

export function SignOutButton() {
  const router = useRouter();
  async function handleSignOut() {
    await signOut();
    router.push("/login");
    router.refresh();
  }
  return (
    <button
      onClick={handleSignOut}
      className="text-sm text-white/80 underline hover:text-white"
    >
      Sign out
    </button>
  );
}
