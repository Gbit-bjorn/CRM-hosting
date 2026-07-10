"use client";
import { useState } from "react";
import { Eye, EyeOff, Copy, Check } from "lucide-react";

/** Toont een wachtwoord verborgen (••••) met toon- en kopieerknop. */
export default function WachtwoordVeld({ waarde }: { waarde: string }) {
  const [toon, setToon] = useState(false);
  const [gekopieerd, setGekopieerd] = useState(false);

  const kopieer = async () => {
    await navigator.clipboard.writeText(waarde);
    setGekopieerd(true);
    setTimeout(() => setGekopieerd(false), 1500);
  };

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="tnum font-mono text-xs text-neutral-600">{toon ? waarde : "••••••••"}</span>
      <button
        type="button"
        onClick={() => setToon(!toon)}
        className="text-neutral-400 hover:text-neutral-700"
        aria-label={toon ? "Verberg wachtwoord" : "Toon wachtwoord"}
      >
        {toon ? <EyeOff size={13} /> : <Eye size={13} />}
      </button>
      <button
        type="button"
        onClick={kopieer}
        className="text-neutral-400 hover:text-neutral-700"
        aria-label="Kopieer wachtwoord"
      >
        {gekopieerd ? <Check size={13} className="text-ok-text" /> : <Copy size={13} />}
      </button>
    </span>
  );
}
