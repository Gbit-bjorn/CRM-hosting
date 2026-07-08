// Eenmalig hulpscript: zet actieDatum van alle factuurmomenten op
// renewalDate − 45 dagen (nieuwe lead-time, was − 1 maand). Idempotent.
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { db } = await import("../src/lib/db");
  const { actieDatum } = await import("../src/lib/billing");

  const abos = await db.abonnement.findMany({ select: { id: true, renewalDate: true } });
  let n = 0;
  for (const a of abos) {
    const r = await db.factuurMoment.updateMany({
      where: { abonnementId: a.id },
      data: { actieDatum: actieDatum(a.renewalDate) },
    });
    n += r.count;
  }
  console.log(`${n} factuurmomenten herberekend op renewal − 45 dagen (${abos.length} abonnementen).`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
