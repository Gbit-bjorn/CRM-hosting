// Gedeelde Tailwind-klassen voor consistente, dichte datatabellen.
export const tbl = {
  wrap: "overflow-hidden rounded-lg border border-neutral-200 bg-white",
  scroll: "max-h-[calc(100vh-13rem)] overflow-auto",
  table: "w-full border-collapse text-sm",
  th: "sticky top-0 z-10 border-b border-neutral-200 bg-neutral-50 px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-500",
  thNum:
    "sticky top-0 z-10 border-b border-neutral-200 bg-neutral-50 px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-neutral-500",
  tr: "border-b border-neutral-100 last:border-0 hover:bg-neutral-50",
  td: "px-3 py-2.5 align-middle text-neutral-700",
  tdNum: "tnum px-3 py-2.5 align-middle text-right text-neutral-700",
  tdName: "px-3 py-2.5 align-middle font-medium text-neutral-800",
};
