import { db } from "@/lib/db";
import { listDomains, listClients } from "@/lib/nomeo";

export async function syncNomeo(): Promise<{ domeinen: number; klanten: number }> {
  const [klanten, domeinen] = await Promise.all([listClients(), listDomains()]);

  // nomeo client_id -> db klant id
  const idMap = new Map<string, string>();
  for (const k of klanten) {
    const naam = k.company?.trim() || `${k.firstname} ${k.lastname}`.trim();
    const row = await db.klant.upsert({
      where: { nomeoId: k.id },
      create: { nomeoId: k.id, naam, vatNumber: k.vat_number },
      update: { naam, vatNumber: k.vat_number }, // enkel externe velden; notities blijven ongemoeid
    });
    idMap.set(k.id, row.id);
  }

  for (const d of domeinen) {
    const ext = {
      tld: d.domain.split(".").slice(1).join("."),
      expireDate: d.expire_date ? new Date(d.expire_date) : null,
      registrationDate: d.registration_date ? new Date(d.registration_date) : null,
      autoRenew: d.auto_renew,
      status: d.status,
      inkoopPrijs: d.price,
      klantId: idMap.get(d.client_id) ?? null,
    };
    await db.domein.upsert({
      where: { naam: d.domain },
      create: { naam: d.domain, nomeoId: d.id, ...ext },
      update: ext, // GEEN verkoopPrijs of andere eigen velden
    });
  }

  return { domeinen: domeinen.length, klanten: klanten.length };
}
