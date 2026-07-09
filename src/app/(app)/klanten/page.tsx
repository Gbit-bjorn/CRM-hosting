import Link from "next/link";
import { Plus } from "lucide-react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import KlantenView, { type Kaart } from "@/components/KlantenView";

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
      <PageHeader title="Klanten" count={klanten.length}>
        <Link
          href="/klanten/nieuw"
          className="inline-flex items-center gap-1.5 rounded-md bg-charcoal px-3 py-1.5 text-sm font-medium text-white hover:bg-charcoal/90"
        >
          <Plus size={14} /> Nieuwe klant
        </Link>
      </PageHeader>
      <KlantenView klanten={kaarten} />
    </div>
  );
}
