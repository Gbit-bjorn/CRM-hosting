import Link from "next/link";
import { signOut } from "@/auth";

const items: [string, string][] = [
  ["/", "Radar"],
  ["/klanten", "Klanten"],
  ["/domeinen", "Domeinen"],
  ["/sites", "Sites"],
];

export default function Nav() {
  return (
    <nav className="mb-6 flex items-center gap-5 bg-navy px-6 py-3 text-white">
      <span className="font-semibold tracking-tight">
        G-Bit <span className="text-teal">CRM</span>
      </span>
      {items.map(([href, label]) => (
        <Link key={href} href={href} className="text-sm text-white/80 transition hover:text-white">
          {label}
        </Link>
      ))}
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
        className="ml-auto"
      >
        <button className="text-sm text-white/70 transition hover:text-white">Afmelden</button>
      </form>
    </nav>
  );
}
