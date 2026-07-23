// Portal-account aanmaken of wachtwoord resetten (reseller-portaal /portal).
// Gebruik: npx tsx prisma/portal-account.ts <email> <klant-zoekterm>
// Bestaat het e-mailadres al → nieuw willekeurig wachtwoord (reset).
// Het wachtwoord wordt één keer getoond en nergens bewaard.
import { config } from "dotenv";
config({ path: ".env.local" });
import { randomBytes } from "node:crypto";

async function main() {
  const [email, zoek] = process.argv.slice(2);
  if (!email || !zoek) {
    console.error("Gebruik: npx tsx prisma/portal-account.ts <email> <klant-zoekterm>");
    process.exit(1);
  }

  const { db } = await import("../src/lib/db");
  const { hashWachtwoord } = await import("../src/lib/portal-wachtwoord");

  const klant = await db.klant.findFirst({
    where: { naam: { contains: zoek, mode: "insensitive" } },
    select: { id: true, naam: true },
  });
  if (!klant) throw new Error(`Geen klant gevonden voor "${zoek}"`);

  const wachtwoord = randomBytes(9).toString("base64url"); // 12 tekens
  const account = await db.portalAccount.upsert({
    where: { email: email.toLowerCase() },
    create: {
      email: email.toLowerCase(),
      wachtwoordHash: hashWachtwoord(wachtwoord),
      klantId: klant.id,
    },
    update: { wachtwoordHash: hashWachtwoord(wachtwoord), klantId: klant.id, actief: true },
  });

  console.log(`Portal-account voor ${account.email} → klant "${klant.naam}"`);
  console.log(`Wachtwoord (één keer getoond): ${wachtwoord}`);
  console.log(`Login: https://crm-hosting.vercel.app/portal/login`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
