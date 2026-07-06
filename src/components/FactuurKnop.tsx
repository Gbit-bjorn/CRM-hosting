"use client";
import { useState } from "react";

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
    return <span className="text-xs text-green-600">✓ gefactureerd</span>;
  }
  return (
    <button
      disabled={busy}
      onClick={() => zet("gefactureerd")}
      className="rounded border px-2 py-0.5 text-xs disabled:opacity-50"
    >
      markeer gefactureerd
    </button>
  );
}
