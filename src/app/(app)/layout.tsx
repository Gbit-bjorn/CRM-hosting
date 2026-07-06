import { requireAuth } from "@/lib/auth-guard";
import Nav from "@/components/Nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireAuth();
  return (
    <>
      <Nav />
      <main className="px-6 pb-12">{children}</main>
    </>
  );
}
