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

  // nomeo client_id -> db klant id
  const idMap = new Map<string, string>();
  for (const k of klanten) {
    const naam = k.company?.trim() || `${k.firstname} ${k.lastname}`.trim() || `Nomeo ${k.id}`;
    // Reconcilieer: eerst op nomeoId, dan op naam (versmelt met bestaande seed-klant),
    // anders nieuw. Zo botsen we niet op de unieke naam-constraint.
    const bestaand =
      (await db.klant.findFirst({ where: { nomeoId: k.id } })) ??
      (await db.klant.findFirst({ where: { naam } }));
    const row = bestaand
      ? await db.klant.update({
          where: { id: bestaand.id },
          data: { naam, nomeoId: k.id, vatNumber: k.vat_number }, // enkel externe velden; notities ongemoeid
        })
      : await db.klant.create({
          data: { naam, nomeoId: k.id, vatNumber: k.vat_number },
        });
    idMap.set(k.id, row.id);
  }

  for (const d of domeinen) {
    const ext = {
      nomeoId: d.id,
      tld: d.domain.split(".").slice(1).join("."),
      expireDate: parseDate(d.expire_date),
      registrationDate: parseDate(d.registration_date),
      autoRenew: d.auto_renew,
      status: d.status,
      inkoopPrijs: num(d.price),
      klantId: idMap.get(d.client_id) ?? null,
    };
    await db.domein.upsert({
      where: { naam: d.domain },
      create: { naam: d.domain, ...ext },
      update: ext, // GEEN verkoopPrijs of andere eigen velden
    });
  }

  return { domeinen: domeinen.length, klanten: klanten.length };
}
