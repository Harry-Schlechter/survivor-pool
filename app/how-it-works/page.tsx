import Link from "next/link";
import { RulesContent } from "@/components/rules-content";

// Public copy of the rules: the login page links here, so it must render for
// signed-out visitors. The in-app /rules tab renders the same component
// inside the nav shell.
export default function PublicRulesPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <Link href="/login" className="text-sm text-field underline">
        ← Back to sign in
      </Link>
      <div className="mt-4">
        <RulesContent />
      </div>
    </main>
  );
}
