"use client";
import { useState } from "react";

export default function SyncButton() {
  const [busy, setBusy] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  async function sync() {
    setBusy(true);
    setFout(null);
    const res = await fetch("/api/sync", { method: "POST" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setFout(data.error ?? "Synchronisatie mislukt");
      setBusy(false);
      return;
    }
    location.reload();
  }

  return (
    <div className="flex items-center gap-3">
      {fout && <span className="text-xs text-red-600">{fout}</span>}
      <button
        disabled={busy}
        onClick={sync}
        className="rounded bg-teal px-3 py-1.5 text-sm font-medium text-white transition hover:bg-teal-dark disabled:opacity-50"
      >
        {busy ? "Bezig met synchroniseren…" : "Synchroniseer met Nomeo"}
      </button>
    </div>
  );
}
