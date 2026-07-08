import { db } from "@/lib/db";
import { listDomains, listClients } from "@/lib/nomeo";

/** Parse naar Date of null (Nomeo geeft soms lege/ongeldige datums). */
function parseDate(v: unknown): Date | null {
  if (!v) return null;
  const d = new Date(v as string);
  return isNaN(d.getTime()) ? null : d;
}

/** Parse naar getal of null (Nomeo geeft prijs soms als string). */
function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

export async function syncNomeo(): Promise<{ domeinen: number; klanten: number }> {
  const [klanten, domeinen] = await Promise.all([listClients(), listDomains()]);
  const nomeoKlant = new Map(klanten.map((k) => [k.id, k]));

  let dCount = 0;
  const gemergd = new Set<string>();

  for (const d of domeinen) {
    const bestaand = await db.domein.findUnique({ where: { naam: d.domain } });
    const nk = nomeoKlant.get(d.client_id);
    const nomeoNaam = nk ? nk.company?.trim() || `${nk.firstname} ${nk.lastname}`.trim() : "";

    let klantId: string | null = bestaand?.klantId ?? null;

    if (klantId) {
      // Versmelt de Nomeo-identiteit IN de bestaande klant van dit domein (voorkomt dubbels).
      if (nk && !gemergd.has(klantId)) {
        await db.klant
          .update({
            where: { id: klantId },
            data: { nomeoId: nk.id, vatNumber: nk.vat_number || undefined },
          })
          .catch(() => {}); // nomeoId-uniciteit kan botsen bij gedeelde klant → negeren
        gemergd.add(klantId);
      }
    } else if (nk) {
      // Domein zonder gekende klant → vind of maak op basis van Nomeo.
      const k =
        (await db.klant.findFirst({ where: { nomeoId: nk.id } })) ??
        (await db.klant.findFirst({ where: { naam: nomeoNaam } }));
      const row =
        k ??
        (await db.klant.create({
          data: { naam: nomeoNaam || `Nomeo ${d.client_id}`, nomeoId: nk.id, vatNumber: nk.vat_number || null },
        }));
      klantId = row.id;
    }

    const ext = {
      nomeoId: d.id,
      tld: d.domain.split(".").slice(1).join("."),
      expireDate: parseDate(d.expire_date),
      registrationDate: parseDate(d.registration_date),
      autoRenew: d.auto_renew,
      status: d.status,
      inkoopPrijs: num(d.price),
      klantId,
    };
    await db.domein.upsert({
      where: { naam: d.domain },
      create: { naam: d.domain, ...ext },
      update: ext, // GEEN verkoopPrijs of andere eigen velden
    });
    dCount++;
  }

  // Tijdstip bijhouden zodat de UI kan tonen hoe vers de data is.
  const nu = new Date().toISOString();
  await db.instelling.upsert({
    where: { key: "laatsteSyncNomeo" },
    create: { key: "laatsteSyncNomeo", value: nu },
    update: { value: nu },
  });

  return { domeinen: dCount, klanten: gemergd.size };
}
