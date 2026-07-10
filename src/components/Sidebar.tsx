"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, FolderKanban, Globe, Server, ClipboardCheck, LogOut } from "lucide-react";
import { signOutAction } from "@/lib/actions";

const items = [
  { href: "/", label: "Radar", icon: LayoutDashboard },
  { href: "/klanten", label: "Klanten", icon: Users },
  { href: "/projecten", label: "Projecten", icon: FolderKanban },
  { href: "/domeinen", label: "Domeinen", icon: Globe },
  { href: "/sites", label: "Sites", icon: Server },
  { href: "/controle", label: "Controle", icon: ClipboardCheck },
];

export default function Sidebar() {
  const path = usePathname();
  const isActief = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <>
      {/* Desktop: vaste zijbalk */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col bg-charcoal text-neutral-100 md:flex">
        <div className="px-5 py-4 text-[15px] font-semibold tracking-tight text-white">
          G-Bit <span className="text-coral">CRM</span>
        </div>
        <nav className="flex-1 space-y-0.5 px-3">
          {items.map(({ href, label, icon: Icon }) => {
            const active = isActief(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition ${
                  active
                    ? "bg-charcoal-light font-medium text-white"
                    : "text-neutral-300 hover:bg-charcoal-light/60 hover:text-white"
                }`}
              >
                <Icon size={16} strokeWidth={2} className={active ? "text-coral" : ""} />
                {label}
              </Link>
            );
          })}
        </nav>
        <form action={signOutAction} className="border-t border-white/10 p-3">
          <button className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-neutral-300 transition hover:bg-charcoal-light/60 hover:text-white">
            <LogOut size={16} strokeWidth={2} />
            Afmelden
          </button>
        </form>
      </aside>

      {/* Mobiel: sticky topbar met tab-navigatie */}
      <header className="sticky top-0 z-20 bg-charcoal text-neutral-100 md:hidden">
        <div className="flex items-center justify-between px-4 pt-3">
          <span className="text-[15px] font-semibold tracking-tight text-white">
            G-Bit <span className="text-coral">CRM</span>
          </span>
          <form action={signOutAction}>
            <button
              aria-label="Afmelden"
              className="rounded-md p-2 text-neutral-300 transition hover:bg-charcoal-light/60 hover:text-white"
            >
              <LogOut size={16} strokeWidth={2} />
            </button>
          </form>
        </div>
        <nav className="grid grid-cols-6">
          {items.map(({ href, label, icon: Icon }) => {
            const active = isActief(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center gap-1 border-b-2 px-1 pb-2 pt-2.5 text-[11px] transition ${
                  active
                    ? "border-coral font-medium text-white"
                    : "border-transparent text-neutral-300 hover:text-white"
                }`}
              >
                <Icon size={17} strokeWidth={2} className={active ? "text-coral" : ""} />
                {label}
              </Link>
            );
          })}
        </nav>
      </header>
    </>
  );
}
