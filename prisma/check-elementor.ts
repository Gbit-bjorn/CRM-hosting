// Check: welke van onze domeinen draaien Elementor (Pro)?
// Kijkt naar de homepage-HTML: /wp-content/plugins/elementor/ (gratis) en
// /wp-content/plugins/elementor-pro/ (Pro-licentie). Slaat het resultaat op
// in Domein.elementorPro (gebruikt door het reseller-portaal /portal).
import { config } from "dotenv";
config({ path: ".env.local" });

const TIMEOUT_MS = 10000;

async function checkDomein(naam: string): Promise<{ elementor: boolean; pro: boolean } | null> {
  for (const proto of ["https", "http"]) {
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
      const res = await fetch(`${proto}://${naam}/`, {
        signal: ctl.signal,
        redirect: "follow",
        headers: { "User-Agent": "G-Bit-CRM-check/1.0" },
      });
      clearTimeout(t);
      if (!res.ok) continue;
      const html = (await res.text()).slice(0, 500_000);
      return {
        elementor: html.includes("/wp-content/plugins/elementor") || html.includes("elementor-frontend"),
        pro: html.includes("/wp-content/plugins/elementor-pro"),
      };
    } catch {
      // probeer volgend protocol
    }
  }
  return null;
}

async function main() {
  const { db } = await import("../src/lib/db");
  const domeinen = await db.domein.findMany({
    where: { opOnzeServer: true },
    select: { naam: true, klant: { select: { naam: true } } },
    orderBy: { naam: "asc" },
  });

  const resultaten: { domein: string; klant: string; pro: boolean }[] = [];
  // In stukken van 8 tegelijk — vriendelijk voor de server.
  for (let i = 0; i < domeinen.length; i += 8) {
    const chunk = domeinen.slice(i, i + 8);
    const checks = await Promise.all(chunk.map((d) => checkDomein(d.naam)));
    for (let j = 0; j < chunk.length; j++) {
      const d = chunk[j];
      const r = checks[j];
      if (r) {
        // Alleen bijwerken bij een geslaagde check; mislukte checks laten de oude waarde staan.
        await db.domein.update({ where: { naam: d.naam }, data: { elementorPro: r.pro } });
      }
      if (r?.elementor) {
        resultaten.push({ domein: d.naam, klant: d.klant?.naam ?? "?", pro: r.pro });
      }
    }
    process.stderr.write(`${Math.min(i + 8, domeinen.length)}/${domeinen.length} gecheckt...\n`);
  }

  console.log(JSON.stringify({ totaalGecheckt: domeinen.length, metElementor: resultaten }, null, 1));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
