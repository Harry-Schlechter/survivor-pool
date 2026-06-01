import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";

export function Nav({
  isAdmin,
  userId,
}: {
  isAdmin: boolean;
  userId: string;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-black/10 bg-field text-white">
      <nav className="mx-auto flex max-w-4xl items-center justify-between gap-2 px-3 py-2.5 sm:px-4 sm:py-3">
        <Link href="/" className="shrink-0 font-bold leading-tight">
          🏈 <span className="hidden xs:inline">Jim Olah </span>Survivor
        </Link>
        <div className="flex items-center gap-3 overflow-x-auto text-sm sm:gap-4">
          <Link href="/pick" className="shrink-0 py-1 hover:underline">
            Pick
          </Link>
          <Link
            href={`/profile/${userId}`}
            className="shrink-0 py-1 hover:underline"
          >
            Stats
          </Link>
          <Link href="/rules" className="shrink-0 py-1 hover:underline">
            Rules
          </Link>
          {isAdmin && (
            <Link href="/admin" className="shrink-0 py-1 hover:underline">
              Admin
            </Link>
          )}
          <SignOutButton />
        </div>
      </nav>
    </header>
  );
}
