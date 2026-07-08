"use client";
import { useState } from "react";
import { RefreshCw } from "lucide-react";

export default function SyncButton({ laatsteSync }: { laatsteSync?: string | null }) {
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
      {laatsteSync && !fout && (
        <span className="tnum text-xs text-neutral-400">laatst gesynct {laatsteSync}</span>
      )}
      <button
        disabled={busy}
        onClick={sync}
        className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-600 transition hover:bg-neutral-50 disabled:opacity-50"
      >
        <RefreshCw size={15} className={busy ? "animate-spin" : ""} />
        {busy ? "Synchroniseren…" : "Sync Nomeo"}
      </button>
    </div>
  );
}
