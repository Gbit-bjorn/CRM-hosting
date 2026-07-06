import type { ReactNode } from "react";

export type Tone = "ok" | "warn" | "bad" | "idle";

const dot: Record<Tone, string> = {
  ok: "bg-ok-text",
  warn: "bg-warn-text",
  bad: "bg-bad-text",
  idle: "bg-neutral-400",
};

export function StatusDot({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-neutral-700">
      <span className={`h-2 w-2 shrink-0 rounded-full ${dot[tone]}`} />
      {children}
    </span>
  );
}
