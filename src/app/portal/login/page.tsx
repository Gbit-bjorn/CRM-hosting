import { redirect } from "next/navigation";
import { portalAccount } from "@/lib/portal-auth";
import { portalLogin } from "@/lib/portal-actions";

export const dynamic = "force-dynamic";

export default async function PortalLogin({
  searchParams,
}: {
  searchParams: Promise<{ fout?: string }>;
}) {
  const { fout } = await searchParams;
  if (await portalAccount()) redirect("/portal");

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-25 px-4">
      <div className="w-full max-w-sm space-y-6 rounded-lg border border-neutral-200 bg-white p-6">
        <div>
          <p className="text-lg font-semibold tracking-tight text-charcoal">
            G-Bit <span className="text-coral">Portal</span>
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            Overzicht van jouw hosting en domeinen bij G-Bit.
          </p>
        </div>

        {fout && (
          <p className="rounded-md border border-bad-text/20 bg-bad-bg px-3 py-2 text-sm text-bad-text">
            Aanmelden mislukt — controleer e-mail en wachtwoord.
          </p>
        )}

        <form action={portalLogin} className="space-y-2">
          <input
            name="email"
            type="email"
            placeholder="E-mail"
            autoComplete="username"
            required
            className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-300 focus:ring-2 focus:ring-coral/15"
          />
          <input
            name="wachtwoord"
            type="password"
            placeholder="Wachtwoord"
            autoComplete="current-password"
            required
            className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-300 focus:ring-2 focus:ring-coral/15"
          />
          <button className="w-full rounded-md bg-charcoal py-2 text-sm font-medium text-white transition hover:bg-charcoal-light">
            Aanmelden
          </button>
        </form>

        <p className="text-xs text-neutral-400">
          Geen toegang of wachtwoord vergeten? Mail{" "}
          <a href="mailto:bjorn@g-bit.be" className="text-neutral-500 underline hover:text-coral-hover">
            bjorn@g-bit.be
          </a>
          .
        </p>
      </div>
    </div>
  );
}
