import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { db } from "@/lib/db";
import { radar, isEigenFacturatie } from "@/lib/billing";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { tbl } from "@/components/ui/table";
import SyncButton from "@/components/SyncButton";
import FactuurKnop from "@/components/FactuurKnop";

export const dynamic = "force-dynamic";

type Rij = {
  id: string;
  klantId: string;
  klant: string;
  leverancierStatus: string;
  betreft: string;
  detail: string;
  bedrag: number;
  actieDatum: Date;
  renewalDate: Date;
  status: string;
  domeinVervallen: boolean;
};

function Kpi({
  label,
  waarde,
  sub,
  tone = "text-charcoal",
}: {
  label: string;
  waarde: string;
  sub?: string;
  tone?: string;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{label}</p>
      <p className={`tnum mt-1 text-2xl font-semibold ${tone}`}>{waarde}</p>
      {sub && <p className="tnum mt-0.5 text-xs text-neutral-500">{sub}</p>}
    </div>
  );
}

function som(rijen: Rij[]) {
  return rijen.reduce((s, r) => s + r.bedrag, 0);
}

function registratieBlokkeert(status: string) {
  return status === "vereist" || status === "aangevraagd";
}

function Kaartjes({ rijen }: { rijen: Rij[] }) {
  return (
    <div className="space-y-2 md:hidden">
      {rijen.length === 0 && (
        <p className="rounded-lg border border-neutral-200 bg-white p-4 text-center text-sm text-neutral-400">
          Niets te factureren in deze periode.
        </p>
      )}
      {rijen.map((r) => (
        <div key={r.id} className="rounded-lg border border-neutral-200 bg-white p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-neutral-800">{r.klant}</p>
              <p className="text-sm text-neutral-600">{r.betreft}</p>
              {r.detail && <p className="mt-0.5 text-xs text-neutral-400">{r.detail}</p>}
            </div>
            <p className="tnum shrink-0 text-sm font-semibold text-charcoal">€{r.bedrag.toFixed(2)}</p>
          </div>
          {(registratieBlokkeert(r.leverancierStatus) || r.domeinVervallen) && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {registratieBlokkeert(r.leverancierStatus) && (
                <Badge soort="warn">eerst leveranciersregistratie</Badge>
              )}
              {r.domeinVervallen && <Badge soort="bad">domein vervallen — niet factureren</Badge>}
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 pt-2">
            <p className="tnum text-xs text-neutral-500">
              factureren voor {r.actieDatum.toISOString().slice(0, 10)} · vervalt{" "}
              {r.renewalDate.toISOString().slice(0, 10)}
            </p>
            <FactuurKnop id={r.id} status={r.status} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Lijst({
  titel,
  rijen,
  inklapbaar = false,
}: {
  titel: string;
  rijen: Rij[];
  inklapbaar?: boolean;
}) {
  const inhoud = (
    <>
      <Kaartjes rijen={rijen} />
      <div className={`${tbl.wrap} hidden md:block`}>
        <table className={tbl.table}>
          <thead>
            <tr>
              <th className={tbl.th}>Klant</th>
              <th className={tbl.th}>Betreft</th>
              <th className={tbl.thNum}>Factureren vóór</th>
              <th className={tbl.thNum}>Vervalt op</th>
              <th className={tbl.thNum}>Bedrag</th>
              <th className={tbl.thNum}></th>
            </tr>
          </thead>
          <tbody>
            {rijen.length === 0 && (
              <tr>
                <td className="px-3 py-6 text-center text-sm text-neutral-400" colSpan={6}>
                  Niets te factureren in deze periode.
                </td>
              </tr>
            )}
            {rijen.map((r) => (
              <tr key={r.id} className={tbl.tr}>
                <td className={tbl.tdName}>
                  <span className="inline-flex items-center gap-2">
                    {r.klant}
                    {registratieBlokkeert(r.leverancierStatus) && (
                      <Badge soort="warn">eerst leveranciersregistratie</Badge>
                    )}
                  </span>
                </td>
                <td className={tbl.td}>
                  <span className="inline-flex items-center gap-2">
                    {r.betreft}
                    {r.domeinVervallen && <Badge soort="bad">domein vervallen — niet factureren</Badge>}
                  </span>
                  {r.detail && <span className="block text-xs text-neutral-400">{r.detail}</span>}
                </td>
                <td className={tbl.tdNum}>{r.actieDatum.toISOString().slice(0, 10)}</td>
                <td className={tbl.tdNum}>{r.renewalDate.toISOString().slice(0, 10)}</td>
                <td className={tbl.tdNum}>€{r.bedrag.toFixed(2)}</td>
                <td className={tbl.tdNum}>
                  <FactuurKnop id={r.id} status={r.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );

  if (inklapbaar) {
    return (
      <details className="group">
        <summary className="mb-2 flex cursor-pointer list-none items-center gap-1 text-sm font-semibold text-neutral-700">
          <ChevronRight size={14} className="text-neutral-400 transition group-open:rotate-90" />
          {titel} <span className="tnum text-neutral-400">({rijen.length})</span>
        </summary>
        {inhoud}
      </details>
    );
  }
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-neutral-700">
        {titel} <span className="tnum text-neutral-400">({rijen.length})</span>
      </h2>
      {inhoud}
    </section>
  );
}

function PerKlant({ rijen }: { rijen: Rij[] }) {
  const groepen = new Map<string, Rij[]>();
  for (const r of rijen) {
    const lijst = groepen.get(r.klantId) ?? [];
    lijst.push(r);
    groepen.set(r.klantId, lijst);
  }
  const samengevat = [...groepen.values()]
    .map((g) => ({
      klantId: g[0].klantId,
      klant: g[0].klant,
      leverancierStatus: g[0].leverancierStatus,
      posten: g.length,
      totaal: som(g),
    }))
    .sort((a, b) => b.totaal - a.totaal);

  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-neutral-700">
        Te laat — totaal per klant <span className="tnum text-neutral-400">({samengevat.length})</span>
      </h2>
      <p className="mb-2 text-xs text-neutral-500">
        Deze facturen hadden al de deur uit gemoeten. Eén factuur per klant volstaat — dit zijn de totalen
        van alle te late regels sinds februari.
      </p>
      <div className="space-y-2 md:hidden">
        {samengevat.map((g) => (
          <Link
            key={g.klantId}
            href={`/klanten/${g.klantId}`}
            className="block rounded-lg border border-neutral-200 bg-white p-3"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-neutral-800">{g.klant}</p>
              <p className="tnum shrink-0 text-sm font-semibold text-charcoal">€{g.totaal.toFixed(2)}</p>
            </div>
            <p className="tnum mt-0.5 text-xs text-neutral-500">
              {g.posten} {g.posten === 1 ? "regel" : "regels"}
            </p>
            {registratieBlokkeert(g.leverancierStatus) && (
              <div className="mt-1.5">
                <Badge soort="warn">eerst leveranciersregistratie</Badge>
              </div>
            )}
          </Link>
        ))}
      </div>
      <div className={`${tbl.wrap} hidden md:block`}>
        <table className={tbl.table}>
          <thead>
            <tr>
              <th className={tbl.th}>Klant</th>
              <th className={tbl.thNum}>Regels</th>
              <th className={tbl.thNum}>Totaal</th>
              <th className={tbl.th}>Opgelet</th>
            </tr>
          </thead>
          <tbody>
            {samengevat.map((g) => (
              <tr key={g.klantId} className={tbl.tr}>
                <td className={`${tbl.tdName} whitespace-normal`}>
                  <Link href={`/klanten/${g.klantId}`} className={tbl.rowLink}>
                    {g.klant}
                  </Link>
                </td>
                <td className={tbl.tdNum}>{g.posten}</td>
                <td className={tbl.tdNum}>€{g.totaal.toFixed(2)}</td>
                <td className={`${tbl.td} whitespace-normal`}>
                  {registratieBlokkeert(g.leverancierStatus) && (
                    <Badge soort="warn">
                      leveranciersregistratie {g.leverancierStatus === "vereist" ? "nog aan te vragen" : "aangevraagd"}
                    </Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default async function Radar() {
  const [momenten, sites, domeinen] = await Promise.all([
    db.factuurMoment.findMany({
      include: { abonnement: { include: { klant: true } } },
      orderBy: { actieDatum: "asc" },
    }),
    db.site.findMany({ select: { naam: true, hostingprijs: true } }),
    db.domein.findMany({ select: { naam: true, tld: true, verkoopPrijs: true, registratieStatus: true } }),
  ]);

  // Abonnement, site en domein delen dezelfde naam (het domein) — zo
  // splitsen we het jaarbedrag uit in een hosting- en een domeindeel.
  const siteOp = new Map(sites.map((s) => [s.naam, s]));
  const domeinOp = new Map(domeinen.map((d) => [d.naam, d]));

  const rijen: Rij[] = momenten.map((m) => {
    const naam = m.abonnement.omschrijving ?? "";
    const site = siteOp.get(naam);
    const domein = domeinOp.get(naam);
    const delen: string[] = [];
    if (site) delen.push(`hosting €${(site.hostingprijs ?? 0).toFixed(0)}`);
    if (domein)
      delen.push(`domeinnaam${domein.tld ? ` .${domein.tld}` : ""} €${(domein.verkoopPrijs ?? 0).toFixed(0)}`);
    return {
      id: m.id,
      klantId: m.abonnement.klant.id,
      klant: m.abonnement.klant.naam,
      leverancierStatus: m.abonnement.klant.leverancierStatus,
      betreft: naam,
      detail: delen.join(" + "),
      bedrag: m.bedrag,
      actieDatum: m.actieDatum,
      renewalDate: m.abonnement.renewalDate,
      status: m.status,
      // Whois zei AVAILABLE: registratie is echt weg → niet factureren.
      domeinVervallen: domein?.registratieStatus === "AVAILABLE",
    };
  });

  const vandaag = new Date();
  const startMaand = new Date(vandaag.getFullYear(), vandaag.getMonth(), 1);
  // Verlengingen vóór maart 2026 waren nog voor edu-tech → niet op de radar.
  const eigen = rijen.filter((r) => isEigenFacturatie(r.renewalDate));
  const { dezeMaand, komende90 } = radar(vandaag, eigen);
  const teLaat = eigen.filter((r) => r.status === "te_doen" && r.actieDatum < startMaand);

  const sync = await db.instelling.findUnique({ where: { key: "laatsteSyncNomeo" } });
  const laatsteSync = sync
    ? new Date(sync.value).toLocaleString("nl-BE", {
        timeZone: "Europe/Brussels",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="space-y-6">
      <PageHeader title="Facturatie-radar">
        <SyncButton laatsteSync={laatsteSync} />
      </PageHeader>

      <p className="text-sm text-neutral-500">
        We factureren <strong className="font-medium text-neutral-700">45 dagen vóór de vervaldatum</strong> —
        Nomeo rekent G-Bit daarvóór al aan. &ldquo;Factureren vóór&rdquo; is dus jouw deadline.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Kpi
          label="Deze maand te factureren"
          waarde={`€${som(dezeMaand).toFixed(0)}`}
          sub={`${dezeMaand.length} regels`}
        />
        <Kpi
          label="Te laat te factureren"
          waarde={`€${som(teLaat).toFixed(0)}`}
          sub={`${teLaat.length} regels — deadline verstreken`}
          tone={teLaat.length ? "text-bad-text" : "text-charcoal"}
        />
        <Kpi
          label="Komende 90 dagen"
          waarde={`€${som(komende90).toFixed(0)}`}
          sub={`${komende90.length} regels`}
        />
      </div>

      {teLaat.length > 0 && <PerKlant rijen={teLaat} />}
      {teLaat.length > 0 && <Lijst titel="Te laat — alle regels" rijen={teLaat} inklapbaar />}
      <Lijst titel="Deze maand te factureren" rijen={dezeMaand} />
      <Lijst titel="Komende 90 dagen" rijen={komende90} />

      <p className="text-xs text-neutral-400">Bedragen excl. btw</p>
    </div>
  );
}
