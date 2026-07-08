"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, Check, X } from "lucide-react";
import { verplaatsDomein, verplaatsSite } from "@/lib/mutations";

export type KlantOptie = { id: string; naam: string };

/**
 * Inline "verplaats naar andere klant"-actie voor een domein of site.
 * Abonnement en gekoppelde hosting/domein verhuizen mee (zie mutations.ts).
 */
export default function VerplaatsKnop({
  type,
  id,
  naam,
  huidigeKlantId,
  klanten,
}: {
  type: "domein" | "site";
  id: string;
  naam: string;
  huidigeKlantId: string | null;
  klanten: KlantOptie[];
}) {
  const [open, setOpen] = useState(false);
  const [doel, setDoel] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label={`Verplaats ${naam} naar een andere klant`}
        title="Verplaats naar andere klant"
        className="rounded-md border border-neutral-200 p-1.5 text-neutral-500 transition hover:bg-neutral-50 hover:text-charcoal"
      >
        <ArrowRightLeft size={13} />
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-1">
      <select
        value={doel}
        onChange={(e) => setDoel(e.target.value)}
        className="max-w-44 rounded-md border border-neutral-200 bg-white px-1.5 py-1 text-xs text-neutral-700 outline-none focus:border-neutral-300"
      >
        <option value="">— kies klant —</option>
        {klanten
          .filter((k) => k.id !== huidigeKlantId)
          .map((k) => (
            <option key={k.id} value={k.id}>
              {k.naam}
            </option>
          ))}
      </select>
      <button
        disabled={!doel || pending}
        onClick={() =>
          start(async () => {
            if (type === "domein") await verplaatsDomein(id, doel);
            else await verplaatsSite(id, doel);
            setOpen(false);
            router.refresh();
          })
        }
        aria-label="Bevestig verplaatsen"
        className="rounded-md bg-coral p-1.5 text-white transition hover:bg-coral-hover disabled:opacity-40"
      >
        <Check size={13} />
      </button>
      <button
        onClick={() => setOpen(false)}
        aria-label="Annuleer verplaatsen"
        className="rounded-md border border-neutral-200 p-1.5 text-neutral-500 transition hover:bg-neutral-50"
      >
        <X size={13} />
      </button>
    </span>
  );
}
