import { requireUser } from "@/lib/auth/guards";
import { Nav } from "@/components/nav";
import { TalkSmack } from "@/components/talk-smack";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  return (
    <div className="min-h-screen">
      <Nav isAdmin={user.isAdmin} userId={user.id} />
      <main className="mx-auto max-w-4xl px-4 py-6 pb-24">{children}</main>
      <TalkSmack currentUserId={user.id} />
    </div>
  );
}
