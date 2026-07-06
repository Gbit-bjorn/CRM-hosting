"use client";
import { useState } from "react";
import { Check } from "lucide-react";

export default function FactuurKnop({ id, status }: { id: string; status: string }) {
  const [s, setS] = useState(status);
  const [busy, setBusy] = useState(false);

  async function zet(nieuw: string) {
    setBusy(true);
    await fetch("/api/factuur", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: nieuw }),
    });
    setS(nieuw);
    setBusy(false);
  }

  if (s === "gefactureerd") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-ok-text">
        <Check size={13} /> gefactureerd
      </span>
    );
  }
  return (
    <button
      disabled={busy}
      onClick={() => zet("gefactureerd")}
      className="rounded-md border border-neutral-200 px-2 py-1 text-xs text-neutral-600 transition hover:bg-neutral-50 disabled:opacity-50"
    >
      markeer gefactureerd
    </button>
  );
}
