"use client";
import { useState } from "react";
import { RefreshCw } from "lucide-react";

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
      {fout && <span className="text-xs text-bad-text">{fout}</span>}
      <button
        disabled={busy}
        onClick={sync}
        className="inline-flex items-center gap-1.5 rounded-md bg-teal px-3 py-1.5 text-sm font-medium text-white transition hover:bg-teal-hover disabled:opacity-50"
      >
        <RefreshCw size={15} className={busy ? "animate-spin" : ""} />
        {busy ? "Synchroniseren…" : "Synchroniseer met Nomeo"}
      </button>
    </div>
  );
}
