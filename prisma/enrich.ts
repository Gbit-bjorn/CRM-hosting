// Verrijkt de database: importeert hosting-sites, markeert Bianca als reseller,
// en herberekent prijzen volgens het tariefmodel. Idempotent — mag herhaald worden.
import { config } from "dotenv";
config({ path: ".env.local" });
import { readFileSync } from "fs";

type Sub = { Subscription: string; Subscriber: string | null };

// Bianca's sites (uit mail-bianca-prijsafspraak.md) — zij is de factuurklant (reseller).
const BIANCA_DOMAINS = [
  "phinicka.be",
  "vabiz.be",
  "tophatevents.be",
  "rvenergy.be",
  "academiedevonk.be",
  "tuineneron.be",
  "bartspanhove.com",
];

async function main() {
  const { db } = await import("../src/lib/db");
  const { TARIEF, hostingPrijs } = await import("../src/lib/pricing");
  const subs: Sub[] = JSON.parse(readFileSync("data/plesk-subscriptions.json", "utf8"));

  // 1. Bianca als reseller-klant.
  const bianca = await db.klant.upsert({
    where: { naam: "Bianca Schoonjans (vabiz)" },
    create: { naam: "Bianca Schoonjans (vabiz)", type: "reseller" },
    update: { type: "reseller" },
  });

  // 2. Sites uit de subscriptions (= domeinen met hosting).
  let sitesN = 0;
  for (const s of subs) {
    const naam = String(s.Subscription ?? "").trim();
    if (!naam) continue;
    const domein = await db.domein.findUnique({ where: { naam } });
    const isBianca = BIANCA_DOMAINS.includes(naam);
    const factuurKlantId = isBianca ? bianca.id : domein?.klantId ?? null;
    if (!factuurKlantId) continue; // geen klant te bepalen → overslaan
    const eindKlantId = isBianca ? domein?.klantId ?? null : null;

    const bestaand = await db.site.findFirst({ where: { naam } });
    const data = { factuurKlantId, eindKlantId, hostingprijs: hostingPrijs(isBianca) };
    if (bestaand) {
      await db.site.update({ where: { id: bestaand.id }, data });
    } else {
      await db.site.create({ data: { naam, ...data } });
    }
    sitesN++;
  }

  // 3. Prijzen + facturatie herberekenen per domein.
  const domeinen = await db.domein.findMany();
  let herberekend = 0;
  for (const d of domeinen) {
    const site = await db.site.findFirst({ where: { naam: d.naam } });
    const isBianca = BIANCA_DOMAINS.includes(d.naam) || site?.factuurKlantId === bianca.id;
    const hostingDeel = site ? site.hostingprijs ?? hostingPrijs(isBianca) : 0;
    const jaarbedrag = TARIEF.domein + hostingDeel;

    await db.domein.update({ where: { id: d.id }, data: { verkoopPrijs: TARIEF.domein } });

    const abo = await db.abonnement.findFirst({ where: { omschrijving: d.naam } });
    if (abo) {
      await db.abonnement.update({
        where: { id: abo.id },
        data: { jaarbedrag, klantId: isBianca ? bianca.id : abo.klantId },
      });
      await db.factuurMoment.updateMany({ where: { abonnementId: abo.id }, data: { bedrag: jaarbedrag } });
      herberekend++;
    }
  }

  console.log(`Verrijking klaar: ${sitesN} sites, ${herberekend} abonnementen herberekend.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
