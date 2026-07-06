import { db } from "@/lib/db";
import { DataTable, type Column } from "@/components/DataTable";

export const dynamic = "force-dynamic";

type Rij = {
  naam: string;
  factuurKlant: { naam: string } | null;
  pleskStatus: string | null;
  verbruikMB: number | null;
};

export default async function Sites() {
  const sites = await db.site.findMany({
    include: { factuurKlant: true },
    orderBy: { naam: "asc" },
  });

  const cols: Column<Rij>[] = [
    { key: "naam", label: "Site" },
    { key: "factuurKlant", label: "Factuurklant", render: (s) => s.factuurKlant?.naam ?? "—" },
    { key: "pleskStatus", label: "Status", render: (s) => s.pleskStatus ?? "—" },
    { key: "verbruikMB", label: "Verbruik (MB)", render: (s) => s.verbruikMB ?? "—" },
  ];

  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold">Sites ({sites.length})</h1>
      <DataTable columns={cols} rows={sites as Rij[]} />
    </div>
  );
}
