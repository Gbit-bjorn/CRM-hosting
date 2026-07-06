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
    <nav className="mb-6 flex items-center gap-4 border-b px-6 py-3">
      <span className="font-semibold">G-Bit CRM</span>
      {items.map(([href, label]) => (
        <Link key={href} href={href} className="text-sm hover:underline">
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
        <button className="text-sm text-gray-500 hover:text-gray-800">Afmelden</button>
      </form>
    </nav>
  );
}
