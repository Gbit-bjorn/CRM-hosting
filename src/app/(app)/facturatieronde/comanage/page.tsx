import { db } from "@/lib/db";
import { listClients } from "@/lib/nomeo";
import { isEigenFacturatie } from "@/lib/billing";
import { bouwComanageLijst, type KlantVoorCoManage, type NomeoKlantRij } from "@/lib/ronde";
import ComanageLijst from "@/components/ComanageLijst";

export const dynamic = "force-dynamic";

export default async function ComanageInvulblad() {
  const [klanten, momenten, nomeoKlanten] = await Promise.all([
    db.klant.findMany({
      where: { comanageId: null, NOT: { type: "intern" } },
      select: {
        id: true, naam: true, type: true, vatNumber: true, adres: true, stad: true,
        postcode: true, comanageId: true, nomeoId: true, notities: true, leverancierStatus: true,
        contacten: { select: { naam: true, email: true, telefoon: true }, orderBy: { naam: "asc" } },
      },
      orderBy: { naam: "asc" },
    }),
    db.factuurMoment.findMany({
      where: { status: "te_doen" },
      select: { bedrag: true, abonnement: { select: { klantId: true, renewalDate: true } } },
    }),
    listClients().catch((e) => {
      console.error("CoManage-invulblad: Nomeo onbereikbaar:", e);
      return null as NomeoKlantRij[] | null;
    }),
  ]);

  const openPerKlant = new Map<string, { bedrag: number; regels: number }>();
  for (const m of momenten) {
    if (!isEigenFacturatie(m.abonnement.renewalDate)) continue;
    const t = openPerKlant.get(m.abonnement.klantId) ?? { bedrag: 0, regels: 0 };
    t.bedrag += m.bedrag;
    t.regels += 1;
    openPerKlant.set(m.abonnement.klantId, t);
  }

  const rijen = bouwComanageLijst(
    klanten.map((k) => ({ ...k, contactenVol: k.contacten })) as unknown as KlantVoorCoManage[],
    nomeoKlanten,
    openPerKlant,
  );

  return <ComanageLijst rijen={rijen} nomeoBereikbaar={nomeoKlanten !== null} />;
}
