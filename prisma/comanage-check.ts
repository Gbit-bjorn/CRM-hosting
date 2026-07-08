// Verkenning van de CoManage-API: vergelijk CoManage-contacten met CRM-klanten
// (eerst op btw-nummer, dan op naam-tokens). Read-only, verandert niets.
import { config } from "dotenv";
config({ path: ".env.local" });

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

  const [contacts, invoices, klanten] = await Promise.all([
    listContacts(),
    listInvoices(),
    db.klant.findMany({ select: { id: true, naam: true, vatNumber: true, comanageId: true } }),
  ]);
  console.log(`CoManage: ${contacts.length} contacten, ${invoices.length} facturen · CRM: ${klanten.length} klanten\n`);

  const perStatus = new Map<string, number>();
  for (const f of invoices) {
    const s = String(f.status ?? "?");
    perStatus.set(s, (perStatus.get(s) ?? 0) + 1);
  }
  console.log("Facturen per status:", Object.fromEntries(perStatus), "\n");

  let btwMatch = 0;
  let naamMatch = 0;
  const twijfel: string[] = [];
  const geen: string[] = [];

  for (const c of contacts) {
    if (c.trashed) continue;
    const naam = String(c.name ?? "");
    const btw = normBtw(c.vat_number as string | null);

    const opBtw = btw ? klanten.find((k) => normBtw(k.vatNumber) === btw) : undefined;
    if (opBtw) {
      btwMatch++;
      console.log(`BTW   ${naam}  ⇔  ${opBtw.naam}`);
      continue;
    }

    const cTok = tokens(naam);
    let beste: { naam: string; score: number } | null = null;
    for (const k of klanten) {
      const score = overlap(cTok, tokens(k.naam));
      if (!beste || score > beste.score) beste = { naam: k.naam, score };
    }
    if (beste && beste.score >= 2) {
      naamMatch++;
      console.log(`NAAM  ${naam}  ⇔  ${beste.naam}  (${beste.score} tokens)`);
    } else if (beste && beste.score === 1) {
      twijfel.push(`${naam}  ~?  ${beste.naam}`);
    } else {
      geen.push(naam);
    }
  }

  console.log(`\nSamenvatting: ${btwMatch} op btw · ${naamMatch} op naam · ${twijfel.length} twijfel · ${geen.length} geen match`);
  if (twijfel.length) {
    console.log("\nTwijfelgevallen (1 gedeeld naamdeel):");
    for (const t of twijfel) console.log("  ~", t);
  }
  if (geen.length) {
    console.log("\nGeen match (waarschijnlijk niet-hostingklanten van G-Bit):");
    for (const n of geen) console.log("  -", n);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
