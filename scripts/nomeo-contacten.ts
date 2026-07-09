// Haalt per Nomeo-domein de domeincontacten op (registrant / on-site (whois) /
// admin / tech / billing) en bewaart ze als JSON op het Domein-record.
// Leest enkel uit Nomeo — wijzigingen doe je in het Nomeo-portaal zelf.
// Gebruik: npm run nomeo-contacten
import { config } from "dotenv";
config({ path: ".env.local" });

(async () => {
  const { db } = await import("../src/lib/db");
  const { getNomeoToken, getDomainDetail } = await import("../src/lib/nomeo");

  const token = await getNomeoToken();
  const domeinen = await db.domein.findMany({
    where: { nomeoId: { not: null } },
    select: { id: true, naam: true },
    orderBy: { naam: "asc" },
  });

  let bijgewerkt = 0;
  const fouten: string[] = [];
  for (const d of domeinen) {
    try {
      const detail = await getDomainDetail(d.naam, token);
      await db.domein.update({
        where: { id: d.id },
        data: {
          nomeoContacts: JSON.parse(JSON.stringify(detail.contacts ?? null)),
          nomeoContactsCheck: new Date(),
        },
      });
      bijgewerkt++;
    } catch (e) {
      fouten.push(`${d.naam}: ${(e as Error).message}`);
    }
    await new Promise((r) => setTimeout(r, 250)); // vriendelijk voor de API
  }
  console.log(JSON.stringify({ bijgewerkt, fouten }));
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
