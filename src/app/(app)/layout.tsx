import { requireAuth } from "@/lib/auth-guard";
import Sidebar from "@/components/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireAuth();
  return (
    <div className="min-h-screen bg-neutral-25">
      <Sidebar />
      <div className="md:pl-60">
        <main className="mx-auto max-w-[1440px] px-4 py-4 md:px-6 md:py-6">{children}</main>
      </div>
    </div>
  );
}
