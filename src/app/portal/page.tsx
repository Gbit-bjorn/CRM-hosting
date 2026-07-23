import { db } from "@/lib/db";
import { vereisPortalAccount } from "@/lib/portal-auth";
import { portalLogout } from "@/lib/portal-actions";
import { StatusDot, type Tone } from "@/components/ui/StatusDot";
import { Badge } from "@/components/ui/Badge";
import { tbl } from "@/components/ui/table";

export const dynamic = "force-dynamic";

function datum(d: Date | null | undefined): string {
  if (!d) return "—";
  return d.toLocaleDateString("nl-BE", {
    timeZone: "Europe/Brussels",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function Kpi({ label, waarde }: { label: string; waarde: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="tnum mt-1 text-2xl font-semibold text-charcoal">{waarde}</p>
    </div>
  );
}

export default async function Portal() {
  const account = await vereisPortalAccount();
  const klantId = account.klant.id;

  const [abonnementen, sites, domeinen, beheerSites] = await Promise.all([
    db.abonnement.findMany({
      where: { klantId },
      select: {
        id: true,
        omschrijving: true,
        jaarbedrag: true,
        renewalDate: true,
        factuurMomenten: {
          orderBy: { actieDatum: "desc" },
          take: 1,
          select: { status: true, actieDatum: true },
        },
      },
      orderBy: { renewalDate: "asc" },
    }),
    db.site.findMany({
      where: { factuurKlantId: klantId },
      select: { naam: true, hostingprijs: true },
    }),
    db.domein.findMany({
      where: { klantId },
      select: { naam: true, tld: true, expireDate: true, verkoopPrijs: true, elementorPro: true },
    }),
    db.site.findMany({ where: { beheerKlantId: klantId }, select: { naam: true } }),
  ]);

  const siteOp = new Map(sites.map((s) => [s.naam, s]));
  const domeinOp = new Map(domeinen.map((d) => [d.naam, d]));

  const rijen = abonnementen.map((a) => {
    const naam = a.omschrijving ?? "";
    const site = siteOp.get(naam);
    const domein = domeinOp.get(naam);
    const delen: string[] = [];
    if (site) delen.push(`hosting €${(site.hostingprijs ?? 0).toFixed(0)}`);
    if (domein)
      delen.push(`domeinnaam${domein.tld ? ` .${domein.tld}` : ""} €${(domein.verkoopPrijs ?? 0).toFixed(0)}`);
    const moment = a.factuurMomenten[0];
    let statusTekst = "factuur volgt";
    let tone: Tone = "idle";
    if (moment?.status === "gefactureerd") {
      statusTekst = "gefactureerd";
      tone = "warn";
    } else if (moment?.status === "betaald") {
      statusTekst = "betaald";
      tone = "ok";
    } else if (moment) {
      statusTekst = `factuur volgt (±${datum(moment.actieDatum)})`;
    }
    return {
      id: a.id,
      naam,
      samenstelling: delen.join(" + ") || "—",
      hosting: !!site,
      jaarbedrag: a.jaarbedrag,
      vervalt: a.renewalDate,
      statusTekst,
      tone,
    };
  });

  const totaalJaar = rijen.reduce((s, r) => s + r.jaarbedrag, 0);

  // Elementor Pro: eigen domeinen + domeinen van sites die zij beheert.
  const beheerNamen = beheerSites.map((s) => s.naam);
  const beheerElementor = beheerNamen.length
    ? await db.domein.findMany({
        where: { naam: { in: beheerNamen }, elementorPro: true },
        select: { naam: true },
      })
    : [];
  const elementorSites = [
    ...new Set([
      ...domeinen.filter((d) => d.elementorPro).map((d) => d.naam),
      ...beheerElementor.map((d) => d.naam),
    ]),
  ].sort();

  return (
    <div className="min-h-screen bg-neutral-25">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <p className="text-base font-semibold tracking-tight text-charcoal">
            G-Bit <span className="text-coral">Portal</span>
          </p>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-neutral-500 sm:inline">{account.klant.naam}</span>
            <form action={portalLogout}>
              <button className="rounded-md border border-neutral-200 px-3 py-1.5 text-sm text-neutral-600 transition hover:bg-neutral-50">
                Afmelden
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-6">
        <div>
          <h1 className="text-lg font-semibold text-charcoal">Jouw hosting &amp; domeinen</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Wij factureren ongeveer 45 dagen vóór de vervaldatum van elk abonnement.
            Alle bedragen zijn per jaar en excl. btw.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Kpi label="Hosting-sites" waarde={String(sites.length)} />
          <Kpi label="Domeinnamen" waarde={String(domeinen.length)} />
          <Kpi label="Totaal per jaar" waarde={`€${totaalJaar.toFixed(0)}`} />
        </div>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-neutral-700">
            Abonnementen <span className="tnum font-normal text-neutral-400">({rijen.length})</span>
          </h2>
          <div className={tbl.wrap}>
            <table className={tbl.table}>
              <thead>
                <tr>
                  <th className={tbl.th}>Wat</th>
                  <th className={tbl.th}>Samenstelling</th>
                  <th className={tbl.thNum}>Per jaar</th>
                  <th className={tbl.thNum}>Vervalt op</th>
                  <th className={tbl.th}>Facturatie</th>
                </tr>
              </thead>
              <tbody>
                {rijen.length === 0 && (
                  <tr>
                    <td className="px-3 py-6 text-center text-sm text-neutral-400" colSpan={5}>
                      Geen actieve abonnementen.
                    </td>
                  </tr>
                )}
                {rijen.map((r) => (
                  <tr key={r.id} className={tbl.tr}>
                    <td className={tbl.tdName}>
                      <span className="inline-flex items-center gap-2">
                        {r.naam}
                        <Badge soort={r.hosting ? "hosting" : "domein"}>
                          {r.hosting ? "hosting + domein" : "enkel domein"}
                        </Badge>
                      </span>
                    </td>
                    <td className={tbl.td}>{r.samenstelling}</td>
                    <td className={tbl.tdNum}>€{r.jaarbedrag.toFixed(0)}</td>
                    <td className={tbl.tdNum}>{datum(r.vervalt)}</td>
                    <td className={tbl.td}>
                      <StatusDot tone={r.tone}>{r.statusTekst}</StatusDot>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {beheerSites.length > 0 && (
          <section>
            <h2 className="mb-0.5 text-sm font-semibold text-neutral-700">
              Sites in beheer{" "}
              <span className="tnum font-normal text-neutral-400">({beheerSites.length})</span>
            </h2>
            <p className="mb-2 text-xs text-neutral-500">
              Hier doe jij het beheer; de hosting-facturatie loopt rechtstreeks tussen G-Bit en de
              eindklant — deze staan dus níét op jouw factuur.
            </p>
            <div className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
              {beheerSites.map((s) => (
                <div key={s.naam} className="px-3 py-2.5 text-sm font-medium text-neutral-800">
                  {s.naam}
                </div>
              ))}
            </div>
          </section>
        )}

        {elementorSites.length > 0 && (
          <section>
            <h2 className="mb-0.5 text-sm font-semibold text-neutral-700">
              Elementor Pro{" "}
              <span className="tnum font-normal text-neutral-400">({elementorSites.length})</span>
            </h2>
            <p className="mb-2 text-xs text-neutral-500">
              Sites die volgens onze laatste automatische scan op een Elementor Pro-licentie draaien.
              De licenties zelf beheer en factureer jij.
            </p>
            <div className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
              {elementorSites.map((naam) => (
                <div key={naam} className="px-3 py-2.5 text-sm text-neutral-700">
                  {naam}
                </div>
              ))}
            </div>
          </section>
        )}

        <p className="text-xs text-neutral-400">
          Vragen over dit overzicht? Mail{" "}
          <a href="mailto:bjorn@g-bit.be" className="underline hover:text-coral-hover">
            bjorn@g-bit.be
          </a>
          .
        </p>
      </main>
    </div>
  );
}
