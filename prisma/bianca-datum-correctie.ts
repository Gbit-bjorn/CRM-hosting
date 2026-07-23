// Eenmalig hulpscript (2026-07-23): verouderde abonnementsdatums van Bianca
// gelijkzetten met de echte domein-verlengingen (goedkeuring Bjorn 2026-07-22).
// - tophatevents.be + phinicka.be: renewal 2026-02-28 → 2026-03-01 (de domeinen
//   zijn effectief op 01/03/2026 verlengd; 28/02 viel nét vóór de eigen-facturatie-
//   grens van maart 2026 waardoor deze regels onterecht van de radar bleven).
// - saltandsweetbakery.be: renewal 2026-02-14 → 2027-02-15 (de verlenging van
//   feb 2026 was nog edu-tech-periode; eerstvolgende factureerbare is die van 2027).
// actieDatum wordt herrekend via dezelfde logica als de app. Idempotent.
import { config } from "dotenv";
config({ path: ".env.local" });

const CORRECTIES: { domein: string; renewal: string }[] = [
  { domein: "tophatevents.be", renewal: "2026-03-01" },
  { domein: "phinicka.be", renewal: "2026-03-01" },
  { domein: "saltandsweetbakery.be", renewal: "2027-02-15" },
];

async function main() {
  const { db } = await import("../src/lib/db");
  const { actieDatum } = await import("../src/lib/billing");

  for (const c of CORRECTIES) {
    const abo = await db.abonnement.findFirst({
      where: { omschrijving: c.domein },
      select: { id: true, renewalDate: true },
    });
    if (!abo) throw new Error(`Abonnement voor ${c.domein} niet gevonden`);

    const renewal = new Date(c.renewal);
    await db.abonnement.update({
      where: { id: abo.id },
      data: { renewalDate: renewal },
    });
    const momenten = await db.factuurMoment.updateMany({
      where: { abonnementId: abo.id, status: "te_doen" },
      data: { actieDatum: actieDatum(renewal) },
    });
    console.log(
      `${c.domein}: renewal ${abo.renewalDate.toISOString().slice(0, 10)} → ${c.renewal}, ` +
        `${momenten.count} open moment(en) op actie ${actieDatum(renewal).toISOString().slice(0, 10)}`
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
