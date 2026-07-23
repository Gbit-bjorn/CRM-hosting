// Read-only: alle records rond tophatevents.be (site, domein, abonnement,
// factuurmomenten) — controle van de prijsuitsplitsing op de radar.
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { db } = await import("../src/lib/db");
  const [site, domein, abo] = await Promise.all([
    db.site.findFirst({ where: { naam: { contains: "tophat", mode: "insensitive" } } }),
    db.domein.findFirst({ where: { naam: { contains: "tophat", mode: "insensitive" } } }),
    db.abonnement.findFirst({
      where: { omschrijving: { contains: "tophat", mode: "insensitive" } },
      include: { factuurMomenten: true },
    }),
  ]);
  console.log(JSON.stringify({ site, domein, abonnement: abo }, null, 1));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
