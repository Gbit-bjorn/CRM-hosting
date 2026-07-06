import Link from "next/link";
import { db } from "@/lib/db";
import { DataTable, type Column } from "@/components/DataTable";

export const dynamic = "force-dynamic";

type Rij = {
  id: string;
  naam: string;
  type: string;
  _count: { sites: number; domeinen: number };
};

export default async function Klanten() {
  const klanten = await db.klant.findMany({
    include: { _count: { select: { sites: true, domeinen: true } } },
    orderBy: { naam: "asc" },
  });

  const cols: Column<Rij>[] = [
    {
      key: "naam",
      label: "Klant",
      render: (k) => (
        <Link className="text-blue-600 hover:underline" href={`/klanten/${k.id}`}>
          {k.naam}
        </Link>
      ),
    },
    { key: "type", label: "Type" },
    { key: "sites", label: "Sites", render: (k) => k._count.sites },
    { key: "domeinen", label: "Domeinen", render: (k) => k._count.domeinen },
  ];

  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold">Klanten ({klanten.length})</h1>
      <DataTable columns={cols} rows={klanten as Rij[]} />
    </div>
  );
}
