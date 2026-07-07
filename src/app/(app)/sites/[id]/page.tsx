import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { updateSite } from "@/lib/mutations";
import { Veld, veldKlasse, BewaarKnop, KlantOpties } from "@/components/ui/form";

export const dynamic = "force-dynamic";

export default async function SiteDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [s, klanten] = await Promise.all([
    db.site.findUnique({ where: { id } }),
    db.klant.findMany({ orderBy: { naam: "asc" }, select: { id: true, naam: true } }),
  ]);
  if (!s) return <p className="text-sm text-neutral-500">Site niet gevonden.</p>;

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <Link
          href="/sites"
          className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-coral-hover"
        >
          <ArrowLeft size={14} /> Sites
        </Link>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-charcoal">{s.naam}</h1>
        {s.pleskStatus && <p className="mt-1 text-sm text-neutral-500">Plesk-status: {s.pleskStatus}</p>}
      </div>

      <form action={updateSite.bind(null, s.id)} className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-neutral-700">Bewerken</h2>
        <Veld label="Factuurklant (wie betaalt)">
          <select name="factuurKlantId" defaultValue={s.factuurKlantId} className={veldKlasse}>
            <KlantOpties klanten={klanten} />
          </select>
        </Veld>
        <Veld label="Eindklant (wie zit erachter, optioneel)">
          <select name="eindKlantId" defaultValue={s.eindKlantId ?? ""} className={veldKlasse}>
            <KlantOpties klanten={klanten} leegLabel="— geen eindklant —" />
          </select>
        </Veld>
        <Veld label="Hostingprijs / jaar (excl. btw)">
          <input
            name="hostingprijs"
            type="text"
            inputMode="decimal"
            defaultValue={s.hostingprijs != null ? String(s.hostingprijs) : ""}
            placeholder="bv. 90"
            className={veldKlasse}
          />
        </Veld>
        <BewaarKnop />
      </form>
    </div>
  );
}
