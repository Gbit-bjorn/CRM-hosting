import { requireAuth } from "@/lib/auth-guard";
import Nav from "@/components/Nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireAuth();
  return (
    <div className="min-h-screen bg-mist">
      <Nav />
      <main className="mx-auto max-w-6xl px-6 pb-12">{children}</main>
    </div>
  );
}
