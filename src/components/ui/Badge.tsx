import type { ReactNode } from "react";

export type BadgeSoort =
  | "hosting"
  | "domein"
  | "reseller"
  | "ok"
  | "warn"
  | "bad"
  | "idle";

const stijl: Record<BadgeSoort, string> = {
  hosting: "bg-teal-tint text-teal-hover",
  domein: "bg-neutral-100 text-neutral-600",
  reseller: "border border-navy/20 bg-white text-navy",
  ok: "bg-ok-bg text-ok-text",
  warn: "bg-warn-bg text-warn-text",
  bad: "bg-bad-bg text-bad-text",
  idle: "bg-idle-bg text-idle-text",
};

export function Badge({ soort, children }: { soort: BadgeSoort; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${stijl[soort]}`}
    >
      {children}
    </span>
  );
}
