import { db } from "@/lib/db";
import KlantenGrid, { type Kaart } from "@/components/KlantenGrid";

export const dynamic = "force-dynamic";

export default async function Klanten() {
  const klanten = await db.klant.findMany({
    include: {
      _count: { select: { sites: true, domeinen: true } },
      abonnementen: { select: { jaarbedrag: true } },
      contacten: { take: 1, select: { naam: true, email: true } },
    },
    orderBy: { naam: "asc" },
  });

  const kaarten: Kaart[] = klanten.map((k) => {
    const jaartotaal = k.abonnementen.reduce((s, a) => s + a.jaarbedrag, 0);
    const profiel =
      k._count.sites > 0 ? "hosting" : k._count.domeinen > 0 ? "domein-only" : "leeg";
    const c = k.contacten[0];
    return {
      id: k.id,
      naam: k.naam,
      type: k.type,
      sites: k._count.sites,
      domeinen: k._count.domeinen,
      jaartotaal,
      profiel,
      contact: c ? c.email ?? c.naam : null,
    };
  });

  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold text-navy">Klanten ({klanten.length})</h1>
      <KlantenGrid klanten={kaarten} />
    </div>
  );
}
