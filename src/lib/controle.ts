// Bronvergelijking CRM ↔ Nomeo ↔ CoManage. Pure logica (geen fetches) zodat
// de Controle-pagina en scripts/rapport.ts gegarandeerd dezelfde cijfers geven.
import { normaliseerBtw } from "./vies";
import type { CoContact } from "./comanage";
import type { NomeoClient } from "./nomeo";
import { isEigenFacturatie } from "./billing";

export type KlantRij = {
  id: string;
  naam: string;
  type: string;
  vatNumber: string | null;
  adres: string | null;
  comanageId: string | null;
  nomeoId: string | null;
};

export type BronWaarde = { bron: string; waarde: string };

export type Conflict = {
  klant: KlantRij;
  veld: "vatNumber" | "adres";
  label: string;
  waarden: BronWaarde[];
};

export type AanTeVullen = BronWaarde & {
  klant: KlantRij;
  veld: "vatNumber" | "adres";
  label: string;
};

export type OpenMoment = { bedrag: number; abonnement: { klantId: string; renewalDate: Date } };

export const normAdres = (s: string | null | undefined) =>
  (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

export function coAdresVan(co: CoContact | undefined): string | null {
  const a = co?.addresses?.find((x) => x.type === "billing");
  return a?.address_line_1 ? `${a.address_line_1}, ${a.postcode ?? ""} ${a.city ?? ""}`.trim() : null;
}

export function vergelijkBronnen(
  klanten: KlantRij[],
  coContacts: CoContact[] | null,
  nomeoKlanten: NomeoClient[] | null,
  openMomenten: OpenMoment[],
) {
  const coOp = new Map((coContacts ?? []).map((c) => [String(c.number), c]));
  const nomeoOp = new Map((nomeoKlanten ?? []).map((c) => [c.id, c]));

  const conflicten: Conflict[] = [];
  const aanTeVullen: AanTeVullen[] = [];

  for (const k of klanten) {
    const co = k.comanageId ? coOp.get(k.comanageId) : undefined;
    const no = k.nomeoId ? nomeoOp.get(k.nomeoId) : undefined;

    const btwBronnen = [
      { bron: "CRM", waarde: k.vatNumber },
      { bron: "Nomeo", waarde: no?.vat_number || null },
      { bron: "CoManage", waarde: co?.vat_number || null },
    ].filter((b): b is BronWaarde => !!b.waarde);
    const btwUniek = new Set(btwBronnen.map((b) => normaliseerBtw(b.waarde) ?? b.waarde));
    if (btwUniek.size > 1) {
      conflicten.push({ klant: k, veld: "vatNumber", label: "btw-nummer", waarden: btwBronnen });
    } else if (!k.vatNumber && btwBronnen.length > 0) {
      aanTeVullen.push({ klant: k, veld: "vatNumber", label: "btw-nummer", ...btwBronnen[0] });
    }

    const coAdres = coAdresVan(co);
    if (k.adres && coAdres && normAdres(k.adres) !== normAdres(coAdres)) {
      conflicten.push({
        klant: k,
        veld: "adres",
        label: "adres",
        waarden: [
          { bron: "CRM", waarde: k.adres },
          { bron: "CoManage", waarde: coAdres },
        ],
      });
    } else if (!k.adres && coAdres) {
      aanTeVullen.push({ klant: k, veld: "adres", label: "adres", bron: "CoManage", waarde: coAdres });
    }
  }

  // Open te factureren per klant → bepaalt wie prioritair in CoManage moet.
  const openPerKlant = new Map<string, { bedrag: number; regels: number }>();
  for (const m of openMomenten) {
    if (!isEigenFacturatie(m.abonnement.renewalDate)) continue;
    const t = openPerKlant.get(m.abonnement.klantId) ?? { bedrag: 0, regels: 0 };
    t.bedrag += m.bedrag;
    t.regels += 1;
    openPerKlant.set(m.abonnement.klantId, t);
  }
  const nietGekoppeld = klanten
    .filter((k) => !k.comanageId && k.type !== "intern")
    .map((k) => ({ ...k, open: openPerKlant.get(k.id) ?? { bedrag: 0, regels: 0 } }))
    .sort((a, b) => b.open.bedrag - a.open.bedrag);

  const metBtw = klanten
    .map((k) => ({
      klant: k,
      btw:
        normaliseerBtw(k.vatNumber) ??
        normaliseerBtw(nomeoOp.get(k.nomeoId ?? "")?.vat_number) ??
        normaliseerBtw(coOp.get(k.comanageId ?? "")?.vat_number),
    }))
    .filter((x): x is { klant: KlantRij; btw: string } => !!x.btw);
  const zonderBtw = klanten.filter(
    (k) => !metBtw.some((x) => x.klant.id === k.id) && k.type !== "intern",
  );

  return { conflicten, aanTeVullen, nietGekoppeld, metBtw, zonderBtw };
}
