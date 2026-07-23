// Read-only: Nomeo-domeincontacten + live-check-info van de drie via-Kurt-
// domeinen die naar Bianca gaan (academiedevonk, tuineneron, bartspanhove).
import { config } from "dotenv";
config({ path: ".env.local" });

const DOMEINEN = ["academiedevonk.be", "tuineneron.be", "bartspanhove.com"];

async function main() {
  const { db } = await import("../src/lib/db");
  const rijen = await db.domein.findMany({
    where: { naam: { in: DOMEINEN } },
    select: {
      naam: true,
      expireDate: true,
      nomeoContacts: true,
      liveWaar: true,
      httpStatus: true,
      cms: true,
    },
  });
  console.log(JSON.stringify(rijen, null, 1));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
