// Live-check per domein: DNS (wijst het naar onze Plesk?), HTTP (draait er
// een site, is het WordPress?) en RDAP (échte vervaldatum + registrar, enkel
// voor domeinen buiten Nomeo — Nomeo-datums zijn al live). Read-only.
// Gebruik: npm run live-check   (of: npx tsx scripts/live-check.ts)
import { config } from "dotenv";
config({ path: ".env.local" });
import { promises as dns } from "node:dns";
import net from "node:net";

// De Plesk-webserver (bevestigd 2026-07-09: panel op :8443 + g-bit.be draait er).
// .174 zit in hetzelfde netblok en serveert ook klantensites — tweede IP van de server.
// Let op: 62.213.218.239 (oude notitie) is een spamfilter-node, níét de webserver.
const PLESK_IPS = ["185.179.91.206", "185.179.91.174"];
// Bekende externe adressen, voor duiding in het resultaat.
const BEKEND: Record<string, string> = {
  "62.213.219.148": "urlforward.websrv.be (doorverwijzing, geen hosting)",
  "62.213.218.244": "one.cloudstar.be (shared hosting Cloudstar)",
};
const TIMEOUT_MS = 8000;

type Resultaat = {
  domein: string;
  klant: string | null;
  inNomeo: boolean;
  ip: string | null;
  opOnzePlesk: boolean;
  waar?: string;
  nameservers: string[];
  http: string; // statuscode of foutlabel
  wordpress?: boolean;
  generator?: string;
  rdapVervalt?: string | null;
  rdapRegistrar?: string | null;
  rdapStatus?: string;
};

async function metTimeout<T>(p: Promise<T>): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), TIMEOUT_MS)),
  ]);
}

async function haalPagina(domein: string): Promise<{ http: string; wordpress?: boolean; generator?: string }> {
  for (const proto of ["https", "http"]) {
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
      const res = await fetch(`${proto}://${domein}/`, {
        signal: ctl.signal,
        redirect: "follow",
        headers: { "User-Agent": "G-Bit-CRM-check/1.0" },
      });
      clearTimeout(t);
      const html = (await res.text()).slice(0, 200_000);
      const generator = /<meta[^>]+name=["']generator["'][^>]+content=["']([^"']+)["']/i.exec(html)?.[1];
      return {
        http: String(res.status),
        wordpress: html.includes("wp-content") || html.includes("wp-json") || /wordpress/i.test(generator ?? ""),
        ...(generator ? { generator } : {}),
      };
    } catch {
      // https faalt (geen cert, geen listener) → probeer http; daarna opgeven
    }
  }
  return { http: "onbereikbaar" };
}

/** .be heeft géén RDAP — klassieke whois op poort 43 bij DNS Belgium. */
async function whoisBe(domein: string): Promise<{ rdapVervalt: string | null; rdapRegistrar: string | null; rdapStatus: string }> {
  const antwoord = await new Promise<string>((res) => {
    let s = "";
    const sock = net.connect(43, "whois.dns.be", () => sock.write(domein + "\r\n"));
    sock.on("data", (c) => (s += c));
    sock.on("end", () => res(s));
    sock.on("error", () => res(s));
    setTimeout(() => {
      sock.destroy();
      res(s);
    }, TIMEOUT_MS);
  });
  const status = /Status:\s*(.+)/i.exec(antwoord)?.[1]?.trim() ?? "geen antwoord";
  const registrar = /Registrar:[\s\S]*?Name:\s*(.+)/i.exec(antwoord)?.[1]?.trim() ?? null;
  // whois.dns.be toont geen vervaldatum (privacy); status AVAILABLE = vervallen én weer vrij.
  return { rdapVervalt: null, rdapRegistrar: registrar, rdapStatus: status };
}

async function rdap(domein: string): Promise<{ rdapVervalt: string | null; rdapRegistrar: string | null; rdapStatus: string }> {
  if (domein.endsWith(".be")) return whoisBe(domein);
  try {
    const res = await metTimeout(fetch(`https://rdap.org/domain/${domein}`, { redirect: "follow" }));
    if (res.status === 404) return { rdapVervalt: null, rdapRegistrar: null, rdapStatus: "niet geregistreerd" };
    if (!res.ok) return { rdapVervalt: null, rdapRegistrar: null, rdapStatus: `rdap ${res.status}` };
    const j = (await res.json()) as {
      events?: { eventAction: string; eventDate: string }[];
      entities?: { roles?: string[]; vcardArray?: [string, [string, unknown, string, string][]] }[];
      status?: string[];
    };
    const vervalt = j.events?.find((e) => e.eventAction === "expiration")?.eventDate ?? null;
    const registrarEnt = j.entities?.find((e) => e.roles?.includes("registrar"));
    const registrar =
      (registrarEnt?.vcardArray?.[1]?.find((v) => v[0] === "fn")?.[3] as string | undefined) ?? null;
    return {
      rdapVervalt: vervalt ? vervalt.slice(0, 10) : null,
      rdapRegistrar: registrar,
      rdapStatus: j.status?.join(",") ?? "ok",
    };
  } catch (e) {
    return { rdapVervalt: null, rdapRegistrar: null, rdapStatus: `fout: ${(e as Error).message}` };
  }
}

async function checkDomein(d: { naam: string; klant: string | null; inNomeo: boolean }): Promise<Resultaat> {
  const [ips, ns, pagina] = await Promise.all([
    metTimeout(dns.resolve4(d.naam)).catch(() => [] as string[]),
    metTimeout(dns.resolveNs(d.naam)).catch(() => [] as string[]),
    haalPagina(d.naam),
  ]);
  const basis: Resultaat = {
    domein: d.naam,
    klant: d.klant,
    inNomeo: d.inNomeo,
    ip: ips[0] ?? null,
    opOnzePlesk: ips.some((ip) => PLESK_IPS.includes(ip)),
    ...(ips[0] && BEKEND[ips[0]] ? { waar: BEKEND[ips[0]] } : {}),
    nameservers: ns.map((n) => n.toLowerCase()).sort(),
    ...pagina,
  };
  // RDAP alleen waar Nomeo geen live datum heeft (rate-limits sparen).
  if (!d.inNomeo) Object.assign(basis, await rdap(d.naam));
  return basis;
}

(async () => {
  const { db } = await import("../src/lib/db");
  const domeinen = await db.domein.findMany({
    select: { naam: true, nomeoId: true, klant: { select: { naam: true } } },
    orderBy: { naam: "asc" },
  });
  const werk = domeinen.map((d) => ({ naam: d.naam, klant: d.klant?.naam ?? null, inNomeo: !!d.nomeoId }));

  // Pool van 6 tegelijk — vriendelijk voor DNS/RDAP, snel genoeg voor ±65 domeinen.
  const resultaten: Resultaat[] = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      while (i < werk.length) {
        const item = werk[i++];
        resultaten.push(await checkDomein(item));
      }
    }),
  );
  resultaten.sort((a, b) => a.domein.localeCompare(b.domein));

  // Resultaten bewaren op het Domein-record zodat de app (Controle, detailpagina's)
  // ze kan tonen zonder zelf DNS/HTTP-calls te doen.
  for (const r of resultaten) {
    await db.domein.update({
      where: { naam: r.domein },
      data: {
        liveIp: r.ip,
        liveWaar: r.opOnzePlesk ? "onze Plesk" : (r.waar ?? (r.ip ? "elders" : "geen DNS")),
        opOnzeServer: r.opOnzePlesk,
        httpStatus: r.http,
        cms: r.generator ?? (r.wordpress ? "WordPress" : null),
        registratieStatus: r.rdapStatus ?? null,
        laatsteLiveCheck: new Date(),
      },
    });
  }

  console.log(JSON.stringify(resultaten));
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
