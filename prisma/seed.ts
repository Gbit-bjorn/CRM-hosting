import { config } from "dotenv";
config({ path: ".env.local" });
import { readFileSync } from "fs";

type PleskDomain = {
  "Domain Name": string;
  "Expires on": string | null;
  "Registration date": string | null;
  Status: string | null;
  "Auto renew": string | null;
  Customer: string | null;
};

async function main() {
  // Dynamisch importeren zodat dotenv de DATABASE_URL al geladen heeft.
  const { db } = await import("../src/lib/db");
  const { actieDatum } = await import("../src/lib/billing");
  const domains: PleskDomain[] = JSON.parse(readFileSync("data/plesk-domains.json", "utf8"));

  let n = 0;
  for (const d of domains) {
    const naam = d["Domain Name"];
    if (!naam) continue;

    const klantNaam = (d["Customer"] || "Onbekend").toString().trim();
    const klant = await db.klant.upsert({
      where: { naam: klantNaam },
      create: { naam: klantNaam },
      update: {},
    });

    const expire = d["Expires on"] ? new Date(d["Expires on"]) : null;
    const reg = d["Registration date"] ? new Date(d["Registration date"]) : null;
    const extern = {
      expireDate: expire,
      registrationDate: reg,
      autoRenew: d["Auto renew"] === "on",
      status: d["Status"],
      klantId: klant.id,
    };

    await db.domein.upsert({
      where: { naam },
      create: { naam, tld: naam.split(".").slice(1).join("."), ...extern },
      update: extern,
    });

    if (expire) {
      const bestaat = await db.abonnement.findFirst({
        where: { klantId: klant.id, omschrijving: naam },
      });
      if (!bestaat) {
        const abo = await db.abonnement.create({
          data: { klantId: klant.id, jaarbedrag: 50, renewalDate: expire, omschrijving: naam },
        });
        await db.factuurMoment.create({
          data: { abonnementId: abo.id, actieDatum: actieDatum(expire), bedrag: 50 },
        });
      }
    }
    n++;
  }

  console.log(`Seed klaar: ${n} domeinen verwerkt`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
