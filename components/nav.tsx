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
    <header className="border-b border-gray-200 bg-field text-white">
      <nav className="mx-auto flex max-w-4xl items-center gap-4 px-4 py-3">
        <Link href="/" className="font-bold">
          🏈 Survivor Pool
        </Link>
        <div className="flex flex-1 items-center gap-4 text-sm">
          <Link href="/pick" className="hover:underline">
            Pick
          </Link>
          <Link href={`/profile/${userId}`} className="hover:underline">
            My stats
          </Link>
          <Link href="/rules" className="hover:underline">
            Rules
          </Link>
          {isAdmin && (
            <Link href="/admin" className="hover:underline">
              Admin
            </Link>
          )}
        </div>
        <SignOutButton />
      </nav>
    </header>
  );
}
