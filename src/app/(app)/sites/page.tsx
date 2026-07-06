import { db } from "@/lib/db";
import { DataTable, type Column } from "@/components/DataTable";

export const dynamic = "force-dynamic";

type Rij = {
  naam: string;
  factuurKlant: { naam: string } | null;
  eindKlant: { naam: string } | null;
  hostingprijs: number | null;
};

export default async function Sites() {
  const sites = await db.site.findMany({
    include: { factuurKlant: true, eindKlant: true },
    orderBy: { naam: "asc" },
  });

  const cols: Column<Rij>[] = [
    { key: "naam", label: "Site" },
    { key: "factuurKlant", label: "Factuurklant", render: (s) => s.factuurKlant?.naam ?? "—" },
    {
      key: "eindKlant",
      label: "Eindklant",
      render: (s) => s.eindKlant?.naam ?? "—",
    },
    {
      key: "hostingprijs",
      label: "Hosting/jaar",
      render: (s) => (s.hostingprijs != null ? `€${s.hostingprijs.toFixed(0)}` : "—"),
    },
  ];

  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold text-navy">Sites ({sites.length})</h1>
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <DataTable columns={cols} rows={sites as Rij[]} />
      </div>
    </div>
  );
}
