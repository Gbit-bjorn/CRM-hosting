import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { updateDomein } from "@/lib/mutations";
import { Veld, veldKlasse, BewaarKnop, KlantOpties } from "@/components/ui/form";

export const dynamic = "force-dynamic";

function Regel({ label, waarde }: { label: string; waarde: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-neutral-100 py-1.5 last:border-0">
      <span className="text-neutral-500">{label}</span>
      <span className="tnum text-neutral-800">{waarde}</span>
    </div>
  );
}

export default async function DomeinDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [d, klanten] = await Promise.all([
    db.domein.findUnique({ where: { id }, include: { klant: true } }),
    db.klant.findMany({ orderBy: { naam: "asc" }, select: { id: true, naam: true } }),
  ]);
  if (!d) return <p className="text-sm text-neutral-500">Domein niet gevonden.</p>;

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <Link
          href="/domeinen"
          className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-coral-hover"
        >
          <ArrowLeft size={14} /> Domeinen
        </Link>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-charcoal">{d.naam}</h1>
      </div>

      <section className="rounded-lg border border-neutral-200 bg-white p-4 text-sm">
        <h2 className="mb-2 text-sm font-semibold text-neutral-700">Uit Nomeo (alleen-lezen)</h2>
        <Regel label="Vervaldatum" waarde={d.expireDate ? d.expireDate.toISOString().slice(0, 10) : "—"} />
        <Regel label="Registratie" waarde={d.registrationDate ? d.registrationDate.toISOString().slice(0, 10) : "—"} />
        <Regel label="Auto-renew" waarde={d.autoRenew ? "aan" : "UIT"} />
        <Regel label="Status" waarde={d.status ?? "—"} />
        <Regel label="Inkoop (Nomeo)" waarde={d.inkoopPrijs != null ? `€${d.inkoopPrijs.toFixed(2)}` : "—"} />
      </section>

      <form action={updateDomein.bind(null, d.id)} className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-neutral-700">Bewerken</h2>
        <Veld label="Klant">
          <select name="klantId" defaultValue={d.klantId ?? ""} className={veldKlasse}>
            <KlantOpties klanten={klanten} leegLabel="— geen klant —" />
          </select>
        </Veld>
        <Veld label="Verkoopprijs / jaar (excl. btw)">
          <input
            name="verkoopPrijs"
            type="text"
            inputMode="decimal"
            defaultValue={d.verkoopPrijs != null ? String(d.verkoopPrijs) : ""}
            placeholder="bv. 15"
            className={veldKlasse}
          />
        </Veld>
        <BewaarKnop />
      </form>
    </div>
  );
}
