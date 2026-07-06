"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Globe, Server, LogOut } from "lucide-react";
import { signOutAction } from "@/lib/actions";

const items = [
  { href: "/", label: "Radar", icon: LayoutDashboard },
  { href: "/klanten", label: "Klanten", icon: Users },
  { href: "/domeinen", label: "Domeinen", icon: Globe },
  { href: "/sites", label: "Sites", icon: Server },
];

export default function Sidebar() {
  const path = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 flex w-60 flex-col bg-navy text-neutral-100">
      <div className="px-5 py-4 text-[15px] font-semibold tracking-tight text-white">
        G-Bit <span className="text-teal">CRM</span>
      </div>
      <nav className="flex-1 space-y-0.5 px-3">
        {items.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition ${
                active
                  ? "bg-navy-light font-medium text-white"
                  : "text-neutral-300 hover:bg-navy-light/60 hover:text-white"
              }`}
            >
              <Icon size={16} strokeWidth={2} className={active ? "text-teal" : ""} />
              {label}
            </Link>
          );
        })}
      </nav>
      <form action={signOutAction} className="border-t border-white/10 p-3">
        <button className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-neutral-300 transition hover:bg-navy-light/60 hover:text-white">
          <LogOut size={16} strokeWidth={2} />
          Afmelden
        </button>
      </form>
    </aside>
  );
}
