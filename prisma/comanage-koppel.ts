// Koppelt CRM-klanten aan CoManage-contacten door comanageId in te vullen.
// Match-volgorde: btw-nummer → naam-tokens (≥2) → handmatige mapping.
// Bij meerdere kandidaat-contacten wint het contact met de meeste facturen.
// Idempotent; overschrijft een bestaande comanageId alleen met dezelfde logica.
import { config } from "dotenv";
config({ path: ".env.local" });

// Evidente koppelingen die de automatische matching net mist (CoManage-naam → CRM-naam).
const HANDMATIG: Record<string, string> = {
  "LEUVENSE KATHOLIEKE SCHOLEN AAN DE DIJLE - Campus Miniemeninstituut":
    "Miniemeninstituut - Kurt Roosbeek",
  "BV ORTHOVOS": "Orthovos BV - David Vos",
};

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const STOP = new Set(["de", "het", "een", "van", "en", "bv", "bvba", "nv", "vzw", "vof", "campus"]);
const tokens = (s: string) => new Set(norm(s).split(" ").filter((t) => t.length > 2 && !STOP.has(t)));

function overlap(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const t of a) if (b.has(t)) n++;
  return n;
}

const normBtw = (s: string | null | undefined) => (s ?? "").replace(/[^0-9]/g, "");

async function main() {
  const { listContacts, listInvoices } = await import("../src/lib/comanage");
  const { db } = await import("../src/lib/db");

  const [alleContacts, invoices, klanten] = await Promise.all([
    listContacts(),
    listInvoices(),
    db.klant.findMany({ select: { id: true, naam: true, vatNumber: true, comanageId: true } }),
  ]);
  const contacts = alleContacts.filter((c) => !c.trashed && c.customer);

  // Facturen per contact tellen — bij dubbele CoManage-contacten wint
  // het contact waar effectief op gefactureerd wordt.
  const facturenPer = new Map<number, number>();
  for (const f of invoices) {
    const nr = f.contact?.number;
    if (nr != null) facturenPer.set(nr, (facturenPer.get(nr) ?? 0) + 1);
  }

  // Verzamel kandidaten per CRM-klant.
  const kandidaten = new Map<string, { contact: (typeof contacts)[0]; via: string }[]>();
  const voegToe = (klantId: string, contact: (typeof contacts)[0], via: string) => {
    const lijst = kandidaten.get(klantId) ?? [];
    lijst.push({ contact, via });
    kandidaten.set(klantId, lijst);
  };

  for (const c of contacts) {
    const naam = String(c.name ?? "");
    const btw = normBtw(c.vat_number);

    const opBtw = btw ? klanten.find((k) => normBtw(k.vatNumber) === btw) : undefined;
    if (opBtw) {
      voegToe(opBtw.id, c, "btw");
      continue;
    }
    const handmatig = HANDMATIG[naam];
    if (handmatig) {
      const k = klanten.find((k) => k.naam === handmatig);
      if (k) voegToe(k.id, c, "handmatig");
      continue;
    }
    const cTok = tokens(naam);
    let beste: { id: string; naam: string; score: number } | null = null;
    for (const k of klanten) {
      const score = overlap(cTok, tokens(k.naam));
      if (!beste || score > beste.score) beste = { id: k.id, naam: k.naam, score };
    }
    if (beste && beste.score >= 2) voegToe(beste.id, c, `naam (${beste.score} tokens)`);
  }

  // Per klant het beste contact kiezen en wegschrijven.
  let gezet = 0;
  for (const [klantId, lijst] of kandidaten) {
    lijst.sort((a, b) => (facturenPer.get(b.contact.number) ?? 0) - (facturenPer.get(a.contact.number) ?? 0));
    const winnaar = lijst[0];
    const klant = klanten.find((k) => k.id === klantId)!;
    await db.klant.update({ where: { id: klantId }, data: { comanageId: String(winnaar.contact.number) } });
    gezet++;
    const extra = lijst.length > 1 ? `  (+${lijst.length - 1} ander(e) contact(en) genegeerd)` : "";
    console.log(
      `✔ ${klant.naam}  ← CoManage #${winnaar.contact.number} "${winnaar.contact.name}" via ${winnaar.via}, ${facturenPer.get(winnaar.contact.number) ?? 0} facturen${extra}`,
    );
  }

  const zonder = klanten.filter((k) => !kandidaten.has(k.id) && !k.comanageId);
  console.log(`\n${gezet} klanten gekoppeld · ${zonder.length} CRM-klanten zonder CoManage-contact:`);
  for (const k of zonder) console.log("  -", k.naam);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
