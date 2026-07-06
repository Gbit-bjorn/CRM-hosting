import { db } from "@/lib/db";
import { radar } from "@/lib/billing";
import { DataTable, type Column } from "@/components/DataTable";
import SyncButton from "@/components/SyncButton";
import FactuurKnop from "@/components/FactuurKnop";

export const dynamic = "force-dynamic";

type Rij = {
  id: string;
  klant: string;
  betreft: string;
  bedrag: number;
  actieDatum: Date;
  status: string;
};

function kolommen(): Column<Rij>[] {
  return [
    { key: "klant", label: "Klant" },
    { key: "betreft", label: "Betreft" },
    { key: "bedrag", label: "Bedrag", render: (r) => `€${r.bedrag.toFixed(2)}` },
    {
      key: "actieDatum",
      label: "Factureren voor",
      render: (r) => r.actieDatum.toISOString().slice(0, 10),
    },
    { key: "actie", label: "", render: (r) => <FactuurKnop id={r.id} status={r.status} /> },
  ];
}

function Paneel({ titel, aantal, children }: { titel: string; aantal: number; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 font-medium text-navy">
        {titel} <span className="text-gray-400">({aantal})</span>
      </h2>
      {children}
    </section>
  );
}

export default async function Radar() {
  const momenten = await db.factuurMoment.findMany({
    include: { abonnement: { include: { klant: true } } },
    orderBy: { actieDatum: "asc" },
  });

  const rijen: Rij[] = momenten.map((m) => ({
    id: m.id,
    klant: m.abonnement.klant.naam,
    betreft: m.abonnement.omschrijving ?? "",
    bedrag: m.bedrag,
    actieDatum: m.actieDatum,
    status: m.status,
  }));

  const { dezeMaand, komende90 } = radar(new Date(), rijen);
  const cols = kolommen();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-navy">Facturatie-radar</h1>
        <SyncButton />
      </div>
      <Paneel titel="Deze maand te factureren" aantal={dezeMaand.length}>
        <DataTable columns={cols} rows={dezeMaand} />
      </Paneel>
      <Paneel titel="Komende 90 dagen" aantal={komende90.length}>
        <DataTable columns={cols} rows={komende90} />
      </Paneel>
    </div>
  );
}
