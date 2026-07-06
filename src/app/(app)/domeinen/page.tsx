import { db } from "@/lib/db";
import DomeinenTabel, { type DomeinRij } from "@/components/DomeinenTabel";

export const dynamic = "force-dynamic";

export default async function Domeinen() {
  const [domeinen, sites] = await Promise.all([
    db.domein.findMany({ include: { klant: true }, orderBy: { expireDate: "asc" } }),
    db.site.findMany({ select: { naam: true } }),
  ]);
  const hostingSet = new Set(sites.map((s) => s.naam));

  const rijen: DomeinRij[] = domeinen.map((d) => ({
    naam: d.naam,
    klant: d.klant?.naam ?? "—",
    expireDate: d.expireDate ? d.expireDate.toISOString() : null,
    autoRenew: d.autoRenew,
    status: d.status,
    heeftHosting: hostingSet.has(d.naam),
  }));

  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold text-navy">Domeinen ({domeinen.length})</h1>
      <DomeinenTabel domeinen={rijen} />
    </div>
  );
}
