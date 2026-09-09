import { auth } from "@/auth";
import { db } from "@/lib/db";
import { comanageActief, listContacts } from "@/lib/comanage";
import { listClients, type NomeoClient } from "@/lib/nomeo";
import { bouwDossiers, leesStand, RONDE, type KlantVol, type Stand } from "@/lib/ronde";
import RondeWerkbank from "@/components/RondeWerkbank";

export const dynamic = "force-dynamic";

export default async function Facturatieronde() {
  const session = await auth();
  const [klanten, domeinen, momenten, sites, instellingen, coContacts, nomeoKlanten] =
    await Promise.all([
      db.klant.findMany({
        orderBy: { naam: "asc" },
        select: {
          id: true,
          naam: true,
          type: true,
          vatNumber: true,
          adres: true,
          comanageId: true,
          nomeoId: true,
          notities: true,
          leverancierStatus: true,
          contacten: { select: { naam: true, email: true }, orderBy: { naam: "asc" } },
        },
      }) as unknown as Promise<KlantVol[]>,
      db.domein.findMany({
        select: {
          id: true,
          naam: true,
          klantId: true,
          expireDate: true,
          status: true,
          autoRenew: true,
          nomeoId: true,
          nomeoContacts: true,
          notities: true,
          opOnzeServer: true,
          httpStatus: true,
          registratieStatus: true,
          laatsteLiveCheck: true,
        },
      }),
      db.factuurMoment.findMany({
        select: {
          id: true,
          actieDatum: true,
          status: true,
          abonnement: { select: { klantId: true, omschrijving: true, renewalDate: true } },
        },
      }),
      db.site.findMany({ select: { naam: true, factuurKlantId: true } }),
      db.instelling.findMany({ where: { key: { startsWith: `${RONDE}:` } } }),
      comanageActief()
        ? listContacts().catch((e) => {
            console.error("Facturatieronde: CoManage onbereikbaar:", e);
            return null;
          })
        : Promise.resolve(null),
      listClients().catch((e) => {
        console.error("Facturatieronde: Nomeo onbereikbaar:", e);
        return null as NomeoClient[] | null;
      }),
    ]);

  const sitesPerKlant = new Map<string, number>();
  for (const s of sites) {
    sitesPerKlant.set(s.factuurKlantId, (sitesPerKlant.get(s.factuurKlantId) ?? 0) + 1);
  }

  const dossiers = bouwDossiers({
    vandaag: new Date(),
    klanten,
    domeinen,
    momenten,
    siteNamen: new Set(sites.map((s) => s.naam)),
    sitesPerKlant,
    coContacts,
    nomeoKlanten,
  });

  const standen: Record<string, Stand> = {};
  for (const i of instellingen) standen[i.key.slice(RONDE.length + 1)] = leesStand(i.value);

  const onbereikbaar = [coContacts === null && "CoManage", nomeoKlanten === null && "Nomeo"].filter(
    Boolean,
  ) as string[];

  return (
    <RondeWerkbank
      dossiers={dossiers}
      standen={standen}
      onbereikbaar={onbereikbaar}
      ikBen={session?.user?.email ?? ""}
    />
  );
}
