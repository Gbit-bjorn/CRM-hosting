import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import DomeinenView, { type DomeinRij } from "@/components/DomeinenView";

export const dynamic = "force-dynamic";

export default async function Domeinen() {
  const [domeinen, sites, klanten] = await Promise.all([
    db.domein.findMany({ include: { klant: true }, orderBy: { expireDate: "asc" } }),
    db.site.findMany({ select: { naam: true } }),
    db.klant.findMany({ orderBy: { naam: "asc" }, select: { id: true, naam: true } }),
  ]);
  const hostingSet = new Set(sites.map((s) => s.naam));

  const rijen: DomeinRij[] = domeinen.map((d) => ({
    id: d.id,
    naam: d.naam,
    klant: d.klant?.naam ?? "—",
    klantId: d.klant?.id ?? null,
    expireDate: d.expireDate ? d.expireDate.toISOString() : null,
    autoRenew: d.autoRenew,
    heeftHosting: hostingSet.has(d.naam),
    inNomeo: !!d.nomeoId,
    registratieStatus: d.registratieStatus,
    registrar: d.registrar,
  }));

  return (
    <div>
      <PageHeader title="Domeinen" count={domeinen.length} />
      <DomeinenView domeinen={rijen} klanten={klanten} />
    </div>
  );
}
