import { db } from "@/lib/db";
import { DataTable, type Column } from "@/components/DataTable";

export const dynamic = "force-dynamic";

type Rij = {
  naam: string;
  klant: { naam: string } | null;
  expireDate: Date | null;
  autoRenew: boolean;
  status: string | null;
};

const binnenkort = (d: Date | null) =>
  d ? (+d - Date.now()) / 86_400_000 < 30 : false;

export default async function Domeinen() {
  const domeinen = await db.domein.findMany({
    include: { klant: true },
    orderBy: { expireDate: "asc" },
  });

  const cols: Column<Rij>[] = [
    { key: "naam", label: "Domein" },
    { key: "klant", label: "Klant", render: (d) => d.klant?.naam ?? "—" },
    {
      key: "expireDate",
      label: "Vervalt",
      render: (d) =>
        d.expireDate ? (
          <span className={binnenkort(d.expireDate) ? "font-medium text-red-600" : ""}>
            {d.expireDate.toISOString().slice(0, 10)}
          </span>
        ) : (
          "—"
        ),
    },
    {
      key: "autoRenew",
      label: "Auto-renew",
      render: (d) =>
        d.autoRenew ? "aan" : <span className="font-medium text-red-600">UIT</span>,
    },
    { key: "status", label: "Status", render: (d) => d.status ?? "—" },
  ];

  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold">Domeinen ({domeinen.length})</h1>
      <DataTable columns={cols} rows={domeinen as Rij[]} />
    </div>
  );
}
