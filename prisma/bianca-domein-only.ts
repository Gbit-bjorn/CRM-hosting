// Eenmalig hulpscript (2026-07-22): phinicka.be + vabiz.be worden domein-only.
// Akkoord Bianca per mail 21/07/2026: WordPress-omgevingen schrappen, enkel
// domeinnaam behouden. Abonnement €87 → €15, hosting-site uit het CRM
// (de Controle-pagina toont ze daarna onder "draait bij ons zonder facturatie"
// tot de omgevingen ook echt uit Plesk verwijderd zijn). Idempotent.
import { config } from "dotenv";
config({ path: ".env.local" });

const DOMEINEN = ["phinicka.be", "vabiz.be"];
const DOMEIN_ONLY_PRIJS = 15;

const DOMEIN_NOTITIE =
  "WordPress-omgeving schrappen in Plesk (akkoord Bianca per mail 21/07/2026) — " +
  "enkel domeinnaam behouden, factureren als domein-only (€15/jaar excl. btw). " +
  "Zie problemen/open/ISSUE-002.";

const KLANT_NOTITIE = `Afspraken per mail Bianca 21/07/2026 (bevestiging eerste gesprek):
- phinicka.be + vabiz.be = eigen sites: WordPress-omgeving schrappen, enkel domein factureren (€15/jaar).
- tophatevents.be + rvenergy.be = klanten van haar: akkoord, €87/jaar.
- academiedevonk.be, tuineneron.be, bartspanhove.com = via Kurt binnengekomen (geen eigen klanten): gegevens eindklanten (wie + wanneer factureren) nog aan Bianca bezorgen.
- Zij wacht op ons facturatie-overzicht (wie/wanneer/bedrag) + G-Bit-gegevens voor Elementor-facturatie (checken: Bouwteam & Orthovos, Academie de Vonk).
- Onbevestigd of van haar: magischminitheaterabra.be, nicktails.be, saltandsweetbakery.be (niet vermeld in haar mail).`;

async function main() {
  const { db } = await import("../src/lib/db");

  for (const naam of DOMEINEN) {
    const domein = await db.domein.findUnique({
      where: { naam },
      include: { site: { include: { domeinen: true } } },
    });
    if (!domein) throw new Error(`Domein ${naam} niet gevonden`);

    // 1) Domein loskoppelen van de site + notitie zetten.
    await db.domein.update({
      where: { id: domein.id },
      data: { siteId: null, notities: DOMEIN_NOTITIE },
    });

    // 2) Hosting-site verwijderen (enkel als er geen ander domein meer aan hangt).
    // De site kan via de relatie hangen, maar ook los bestaan met dezelfde naam.
    const site =
      domein.site ??
      (await db.site.findFirst({ where: { naam }, include: { domeinen: true } }));
    if (site) {
      const andere = site.domeinen.filter((d) => d.id !== domein.id);
      if (andere.length === 0) {
        await db.site.delete({ where: { id: site.id } });
        console.log(`${naam}: site "${site.naam}" verwijderd`);
      } else {
        console.log(`${naam}: site heeft nog andere domeinen, enkel losgekoppeld`);
      }
    } else {
      console.log(`${naam}: geen site (meer) gekoppeld`);
    }

    // 3) Abonnement naar domein-only-tarief + open factuurmomenten aanpassen.
    const abo = await db.abonnement.findFirst({ where: { omschrijving: naam } });
    if (!abo) throw new Error(`Abonnement voor ${naam} niet gevonden`);
    await db.abonnement.update({
      where: { id: abo.id },
      data: { jaarbedrag: DOMEIN_ONLY_PRIJS },
    });
    const momenten = await db.factuurMoment.updateMany({
      where: { abonnementId: abo.id, status: "te_doen" },
      data: { bedrag: DOMEIN_ONLY_PRIJS },
    });
    console.log(
      `${naam}: abonnement €${abo.jaarbedrag} → €${DOMEIN_ONLY_PRIJS}, ${momenten.count} open factuurmoment(en) aangepast`
    );
  }

  // 4) Klantnotitie bijwerken met de afspraken uit de mail.
  const bianca = await db.klant.findFirst({
    where: { naam: { contains: "vabiz", mode: "insensitive" } },
  });
  if (!bianca) throw new Error("Klant Bianca (vabiz) niet gevonden");
  await db.klant.update({
    where: { id: bianca.id },
    data: { notities: KLANT_NOTITIE },
  });
  console.log(`Klantnotitie bijgewerkt voor "${bianca.naam}"`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
