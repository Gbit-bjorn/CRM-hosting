import type { ReactNode } from "react";

type Soort = "hosting" | "domein" | "reseller" | "waarschuwing";

const stijl: Record<Soort, string> = {
  hosting: "bg-teal/15 text-teal-dark border border-teal/30",
  domein: "bg-gray-100 text-gray-600 border border-gray-300",
  reseller: "bg-coral/15 text-coral border border-coral/40",
  waarschuwing: "bg-red-50 text-red-700 border border-red-300",
};

export function Badge({ soort, children }: { soort: Soort; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${stijl[soort]}`}
    >
      {children}
    </span>
  );
}
