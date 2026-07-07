import type { ReactNode } from "react";

export const veldKlasse =
  "w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 outline-none focus:border-neutral-300 focus:ring-2 focus:ring-coral/15";

export function Veld({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-neutral-500">{label}</span>
      {children}
    </label>
  );
}

export function BewaarKnop({ children = "Bewaren" }: { children?: ReactNode }) {
  return (
    <button
      type="submit"
      className="rounded-md bg-coral px-3 py-2 text-sm font-medium text-white transition hover:bg-coral-hover"
    >
      {children}
    </button>
  );
}

export function KlantOpties({
  klanten,
  leegLabel,
}: {
  klanten: { id: string; naam: string }[];
  leegLabel?: string;
}) {
  return (
    <>
      {leegLabel && <option value="">{leegLabel}</option>}
      {klanten.map((k) => (
        <option key={k.id} value={k.id}>
          {k.naam}
        </option>
      ))}
    </>
  );
}
