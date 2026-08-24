"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton } from "@/components/sign-out-button";

interface NavLink {
  href: string;
  label: string;
}

export function Nav({
  isAdmin,
  userId,
}: {
  isAdmin: boolean;
  userId: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const links: NavLink[] = [
    { href: "/", label: "Home" },
    { href: "/pick", label: "Pick" },
    { href: "/rules", label: "Rules" },
    { href: `/profile/${userId}`, label: "Stats" },
    ...(isAdmin ? [{ href: "/admin", label: "Admin" }] : []),
  ];

  // "/" would prefix-match everything, so it has to be an exact comparison.
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-30 border-b border-black/10 bg-field text-white">
      <nav className="mx-auto max-w-4xl px-3 sm:px-4">
        <div className="flex items-center justify-between gap-2 py-2.5 sm:py-3">
          <Link
            href="/"
            className="shrink-0 font-bold leading-tight"
            onClick={() => setOpen(false)}
          >
            🏈 <span className="hidden xs:inline">Jim Olah </span>Survivor
          </Link>

          {/* Desktop: inline tabs */}
          <div className="hidden items-center gap-1 sm:flex">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                aria-current={isActive(l.href) ? "page" : undefined}
                className={`rounded-md px-3 py-1.5 text-sm transition ${
                  isActive(l.href)
                    ? "bg-white/15 font-semibold"
                    : "hover:bg-white/10"
                }`}
              >
                {l.label}
              </Link>
            ))}
            <span className="ml-2 border-l border-white/20 pl-3">
              <SignOutButton />
            </span>
          </div>

          {/* Mobile: hamburger */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            className="-mr-1 inline-flex items-center justify-center rounded-md p-2 hover:bg-white/10 sm:hidden"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              {open ? (
                <>
                  <line x1="6" y1="6" x2="18" y2="18" />
                  <line x1="18" y1="6" x2="6" y2="18" />
                </>
              ) : (
                <>
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </>
              )}
            </svg>
          </button>
        </div>

        {/* Mobile dropdown */}
        {open && (
          <div className="border-t border-white/15 pb-3 pt-2 sm:hidden">
            <div className="flex flex-col gap-0.5">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  aria-current={isActive(l.href) ? "page" : undefined}
                  className={`rounded-md px-3 py-2.5 text-sm transition ${
                    isActive(l.href)
                      ? "bg-white/15 font-semibold"
                      : "hover:bg-white/10"
                  }`}
                >
                  {l.label}
                </Link>
              ))}
              <div className="mt-1 border-t border-white/15 px-3 pt-3">
                <SignOutButton />
              </div>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
