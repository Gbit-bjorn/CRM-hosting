import type { ReactNode } from "react";

export function PageHeader({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-3 border-b border-neutral-200 pb-4">
      <h1 className="text-xl font-semibold tracking-tight text-charcoal">{title}</h1>
      {count != null && (
        <span className="tnum rounded-md bg-neutral-100 px-2 py-0.5 text-sm font-medium text-neutral-500">
          {count}
        </span>
      )}
      {children && <div className="ml-auto flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
