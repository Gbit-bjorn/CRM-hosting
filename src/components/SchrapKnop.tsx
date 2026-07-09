"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { schrapFacturatie } from "@/lib/mutations";

/**
 * Schrapt de facturatie (abonnement + momenten) van een vervallen domein.
 * Twee stappen: eerst klikken, dan expliciet bevestigen — nooit automatisch.
 */
export default function SchrapKnop({ domeinNaam, bedrag }: { domeinNaam: string; bedrag: number }) {
  const [bevestig, setBevestig] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  if (!bevestig) {
    return (
      <button
        onClick={() => setBevestig(true)}
        className="rounded-md border border-neutral-200 px-2 py-1 text-xs text-neutral-600 transition hover:bg-neutral-50"
      >
        Schrap facturatie (€{bedrag.toFixed(0)})
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-2">
      <span className="text-xs text-neutral-500">Abonnement + factuurregels verwijderen?</span>
      <button
        disabled={pending}
        onClick={() =>
          start(async () => {
            await schrapFacturatie(domeinNaam);
            router.refresh();
          })
        }
        className="rounded-md bg-bad-bg px-2 py-1 text-xs font-medium text-bad-text transition hover:opacity-80 disabled:opacity-50"
      >
        {pending ? "Bezig…" : "Ja, schrap"}
      </button>
      <button
        disabled={pending}
        onClick={() => setBevestig(false)}
        className="rounded-md border border-neutral-200 px-2 py-1 text-xs text-neutral-600 transition hover:bg-neutral-50"
      >
        Nee
      </button>
    </span>
  );
}
