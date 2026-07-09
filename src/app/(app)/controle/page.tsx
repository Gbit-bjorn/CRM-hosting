import { Suspense } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { db } from "@/lib/db";
import { comanageActief, listContacts } from "@/lib/comanage";
import { listClients, type NomeoClient } from "@/lib/nomeo";
import { checkVat } from "@/lib/vies";
import { vergelijkBronnen, technischeControle, type KlantRij } from "@/lib/controle";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { StatusDot } from "@/components/ui/StatusDot";
import OverneemKnop from "@/components/OverneemKnop";
import SchrapKnop from "@/components/SchrapKnop";

export const dynamic = "force-dynamic";

function Kpi({ label, waarde, slecht }: { label: string; waarde: number; slecht?: boolean }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{label}</p>
      <p className={`tnum mt-1 text-2xl font-semibold ${slecht && waarde > 0 ? "text-bad-text" : waarde === 0 ? "text-ok-text" : "text-charcoal"}`}>
        {waarde}
      </p>
    </div>
  );
}

function Sectie({
  titel,
  aantal,
  sub,
  children,
}: {
  titel: string;
  aantal: number;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-neutral-700">
        {titel} <span className="tnum font-normal text-neutral-400">({aantal})</span>
      </h2>
      <p className="mb-2 mt-0.5 text-xs text-neutral-500">{sub}</p>
      {aantal === 0 ? (
        <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2.5">
          <StatusDot tone="ok">Niets gevonden — in orde.</StatusDot>
        </div>
      ) : (
        <div className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
          {children}
        </div>
      )}
    </section>
  );
}

function KlantLink({ id, naam }: { id: string; naam: string }) {
  return (
    <Link href={`/klanten/${id}`} className="text-sm font-medium text-neutral-800 hover:text-coral-hover hover:underline">
      {naam}
    </Link>
  );
}

function DomeinLink({ id, naam }: { id: string; naam: string }) {
  return (
    <Link href={`/domeinen/${id}`} className="text-sm font-medium text-neutral-800 hover:text-coral-hover hover:underline">
      {naam}
    </Link>
  );
}

/** VIES-validatie, gestreamd. Toont enkel afwijkingen; de rest wordt samengevat. */
async function ViesSectie({ items }: { items: { klant: KlantRij; btw: string }[] }) {
  const resultaten: ({ valid: boolean; name: string | null } | null)[] = [];
  for (let i = 0; i < items.length; i += 5) {
    const chunk = items.slice(i, i + 5);
    resultaten.push(...(await Promise.all(chunk.map((x) => checkVat(x.btw)))));
  }
  const rijen = items.map((x, i) => ({ ...x, r: resultaten[i] }));
  const actief = rijen.filter((x) => x.r?.valid);
  const problemen = rijen.filter((x) => !x.r?.valid);

  return (
    <div className="space-y-2">
      {actief.length > 0 && (
        <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2.5">
          <StatusDot tone="ok">
            {actief.length} btw-nummer{actief.length === 1 ? "" : "s"} actief bevonden bij VIES
          </StatusDot>
        </div>
      )}
      {problemen.length > 0 && (
        <div className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
          {problemen.map((x) => (
            <div key={x.klant.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5">
              <KlantLink id={x.klant.id} naam={x.klant.naam} />
              <span className="tnum text-sm text-neutral-500">{x.btw}</span>
              <span className="ml-auto">
                {x.r === null ? (
                  <StatusDot tone="idle">geen antwoord van VIES</StatusDot>
                ) : (
                  <StatusDot tone="warn">niet btw-actief</StatusDot>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default async function Controle() {
  const [klanten, losseDomeinen, coContacts, nomeoKlanten, openMomenten] = await Promise.all([
    db.klant.findMany({
      orderBy: { naam: "asc" },
      select: {
        id: true,
        naam: true,
        type: true,
        vatNumber: true,
        adres: true,
        comanageId: true,
        nomeoId: true,
      },
    }) as Promise<KlantRij[]>,
    db.domein.findMany({
      where: { nomeoId: null },
      select: { id: true, naam: true, expireDate: true, klant: { select: { naam: true } } },
      orderBy: { expireDate: "asc" },
    }),
    comanageActief()
      ? listContacts().catch((e) => {
          console.error("Controle: CoManage onbereikbaar:", e);
          return null;
        })
      : (console.error("Controle: COMANAGE_API_KEY ontbreekt in deze omgeving"), Promise.resolve(null)),
    listClients().catch((e) => {
      console.error("Controle: Nomeo onbereikbaar:", e);
      return null as NomeoClient[] | null;
    }),
    db.factuurMoment.findMany({
      where: { status: "te_doen" },
      select: { bedrag: true, abonnement: { select: { klantId: true, renewalDate: true } } },
    }),
  ]);
  const [techDomeinen, siteNamen] = await Promise.all([
    db.domein.findMany({
      select: {
        id: true,
        naam: true,
        opOnzeServer: true,
        liveWaar: true,
        httpStatus: true,
        cms: true,
        registratieStatus: true,
        laatsteLiveCheck: true,
        nomeoContacts: true,
        klant: { select: { id: true, naam: true } },
      },
      orderBy: { naam: "asc" },
    }),
    db.site.findMany({ select: { naam: true, hostingprijs: true } }),
  ]);
  const tech = technischeControle(techDomeinen, siteNamen);
  // Openstaand bedrag per vervallen domein — voor de expliciete schrap-knop.
  const vervallenAbos = await db.abonnement.findMany({
    where: { omschrijving: { in: tech.vervallen.map((d) => d.naam) } },
    select: { omschrijving: true, factuurMomenten: { where: { status: "te_doen" }, select: { bedrag: true } } },
  });
  const openPerDomein = new Map(
    vervallenAbos.map((a) => [a.omschrijving ?? "", a.factuurMomenten.reduce((t, m) => t + m.bedrag, 0)]),
  );
  const { conflicten, aanTeVullen, nietGekoppeld, metBtw, zonderBtw } = vergelijkBronnen(
    klanten,
    coContacts,
    nomeoKlanten,
    openMomenten,
  );

  const bronWaarschuwing =
    coContacts === null || nomeoKlanten === null
      ? `Let op: ${coContacts === null ? "CoManage" : ""}${coContacts === null && nomeoKlanten === null ? " en " : ""}${nomeoKlanten === null ? "Nomeo" : ""} was niet bereikbaar — die vergelijking is onvolledig.`
      : null;

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader title="Controle" />
      <p className="text-sm text-neutral-500">
        CRM, Nomeo en CoManage live naast elkaar. Er wordt{" "}
        <strong className="font-medium text-neutral-700">niets automatisch overschreven</strong>: overnemen
        gebeurt per veld, en naar Nomeo of CoManage wordt nooit geschreven.
      </p>
      {bronWaarschuwing && (
        <p className="rounded-md border border-warn-text/20 bg-warn-bg px-3 py-2 text-sm text-warn-text">
          {bronWaarschuwing}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Conflicten" waarde={conflicten.length} slecht />
        <Kpi label="Aan te vullen" waarde={aanTeVullen.length} />
        <Kpi label="Niet in CoManage" waarde={nietGekoppeld.length} />
        <Kpi label="Buiten Nomeo" waarde={losseDomeinen.length} />
      </div>

      <Sectie
        titel="Conflicten"
        aantal={conflicten.length}
        sub="De systemen spreken elkaar tegen — kies per geval welke waarde het CRM krijgt."
      >
        {conflicten.map((c) => (
          <div key={`${c.klant.id}-${c.veld}`} className="px-3 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <KlantLink id={c.klant.id} naam={c.klant.naam} />
              <Badge soort="warn">{c.label} verschilt</Badge>
            </div>
            <dl className={`mt-2 grid gap-2 text-sm ${c.waarden.length >= 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
              {c.waarden.map((w) => (
                <div key={w.bron} className="rounded-md bg-neutral-50 px-2.5 py-1.5">
                  <dt className="text-xs text-neutral-400">{w.bron}</dt>
                  <dd className="tnum break-words text-neutral-700">{w.waarde}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-2 flex flex-wrap gap-2">
              {c.waarden
                .filter((w) => w.bron !== "CRM")
                .map((w) => (
                  <OverneemKnop
                    key={w.bron}
                    klantId={c.klant.id}
                    veld={c.veld}
                    waarde={w.waarde}
                    label={`Neem ${w.bron}-waarde over`}
                  />
                ))}
            </div>
          </div>
        ))}
      </Sectie>

      <Sectie
        titel="Aan te vullen in het CRM"
        aantal={aanTeVullen.length}
        sub="Het CRM is leeg terwijl een bron de waarde kent — geen conflict, wel een gaatje."
      >
        {aanTeVullen.map((a) => (
          <div
            key={`${a.klant.id}-${a.veld}`}
            className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2.5"
          >
            <KlantLink id={a.klant.id} naam={a.klant.naam} />
            <span className="text-sm text-neutral-500">
              {a.label}: <span className="text-neutral-700">{a.waarde}</span>
            </span>
            <span className="ml-auto">
              <OverneemKnop klantId={a.klant.id} veld={a.veld} waarde={a.waarde} />
            </span>
          </div>
        ))}
      </Sectie>

      <Sectie
        titel="Niet in CoManage"
        aantal={nietGekoppeld.length}
        sub="Nog geen klant in de boekhouding — handmatig aanmaken in CoManage vóór je factureert. Gesorteerd op wat er open staat: bovenaan is het dringendst."
      >
        {nietGekoppeld.map((k) => (
          <div key={k.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5">
            <KlantLink id={k.id} naam={k.naam} />
            <span className="ml-auto">
              {k.open.bedrag > 0 ? (
                <span className="tnum text-sm text-neutral-700">
                  €{k.open.bedrag.toFixed(0)} open{" "}
                  <span className="text-xs text-neutral-400">
                    ({k.open.regels} regel{k.open.regels === 1 ? "" : "s"})
                  </span>
                </span>
              ) : (
                <span className="text-xs text-neutral-400">niets open</span>
              )}
            </span>
          </div>
        ))}
      </Sectie>

      <Sectie
        titel="Domeinen buiten Nomeo"
        aantal={losseDomeinen.length}
        sub="Niet in het Nomeo-portfolio — de vervaldatum komt uit de oude Plesk-export en wordt niet ververst. Uitzoeken waar deze geregistreerd zijn."
      >
        {losseDomeinen.map((d) => (
          <div key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5">
            <Link
              href={`/domeinen/${d.id}`}
              className="text-sm font-medium text-neutral-800 hover:text-coral-hover hover:underline"
            >
              {d.naam}
            </Link>
            <span className="text-sm text-neutral-500">{d.klant?.naam ?? "—"}</span>
            <span className="tnum ml-auto text-xs text-neutral-400">
              {d.expireDate ? `Plesk-datum ${d.expireDate.toISOString().slice(0, 10)}` : "geen datum"}
            </span>
          </div>
        ))}
      </Sectie>

      <div className="border-t border-neutral-200 pt-5">
        <h2 className="text-base font-semibold text-charcoal">Technische situatie</h2>
        <p className="mt-0.5 text-xs text-neutral-500">
          Gevoed door de live-check (DNS, HTTP, whois) en de Nomeo-domeincontacten.{" "}
          {tech.gecheckt === 0
            ? "Nog geen live-check gedraaid — voer `npm run live-check` uit."
            : `${tech.gecheckt} domeinen gecheckt.`}
        </p>
      </div>

      <Sectie
        titel="Vervallen en weer vrij"
        aantal={tech.vervallen.length}
        sub="Whois zegt AVAILABLE: registratie is echt weg. Schrap de openstaande factuurregels — dit valt niet meer te verlengen of factureren."
      >
        {tech.vervallen.map((d) => (
          <div key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2.5">
            <DomeinLink id={d.id} naam={d.naam} />
            <span className="text-sm text-neutral-500">{d.klant?.naam ?? "—"}</span>
            <StatusDot tone="bad">vrijgekomen</StatusDot>
            <span className="ml-auto">
              {openPerDomein.has(d.naam) ? (
                <SchrapKnop domeinNaam={d.naam} bedrag={openPerDomein.get(d.naam) ?? 0} />
              ) : (
                <span className="text-xs text-neutral-400">geen facturatie meer</span>
              )}
            </span>
          </div>
        ))}
      </Sectie>

      <Sectie
        titel="Betaalt hosting, maar draait niet bij ons"
        aantal={tech.eldersMetHosting.length}
        sub="Er bestaat een hosting-site in het CRM, maar het domein wijst naar een andere server. Verhuisd of stopgezet? Beslis: facturatie schrappen of terughalen."
      >
        {tech.eldersMetHosting.map((d) => (
          <div key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5">
            <DomeinLink id={d.id} naam={d.naam} />
            <span className="text-sm text-neutral-500">{d.klant?.naam ?? "—"}</span>
            <span className="ml-auto text-xs text-neutral-400">{d.liveWaar ?? "elders"} · HTTP {d.httpStatus ?? "?"}</span>
          </div>
        ))}
      </Sectie>

      <Sectie
        titel="Draait bij ons zonder hosting-facturatie"
        aantal={tech.bijOnsZonderSite.length}
        sub="Het domein wijst naar onze Plesk, maar er is geen hosting-site in het CRM. Mogelijk gratis meeliftend — of een alias/doorverwijzing naar een andere site."
      >
        {tech.bijOnsZonderSite.map((d) => (
          <div key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5">
            <DomeinLink id={d.id} naam={d.naam} />
            <span className="text-sm text-neutral-500">{d.klant?.naam ?? "—"}</span>
            <span className="ml-auto text-xs text-neutral-400">{d.cms ?? ""} · HTTP {d.httpStatus ?? "?"}</span>
          </div>
        ))}
      </Sectie>

      <Sectie
        titel="Kapot op onze server"
        aantal={tech.kapotBijOns.length}
        sub="Wijst naar onze Plesk maar antwoordt niet met HTTP 200 — kapotte of lege site."
      >
        {tech.kapotBijOns.map((d) => (
          <div key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5">
            <DomeinLink id={d.id} naam={d.naam} />
            <span className="text-sm text-neutral-500">{d.klant?.naam ?? "—"}</span>
            <span className="ml-auto"><StatusDot tone="warn">HTTP {d.httpStatus}</StatusDot></span>
          </div>
        ))}
      </Sectie>

      <Sectie
        titel="Verouderde Nomeo-contacten"
        aantal={tech.verouderdContact.length}
        sub="Bij deze domeinen staat EDU-TECH of Casper nog als registrant/whois/admin-contact in Nomeo. Aanpassen doe je in het Nomeo-portaal."
      >
        {tech.verouderdContact.map((d) => (
          <div key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5">
            <DomeinLink id={d.id} naam={d.naam} />
            <span className="text-sm text-neutral-500">{d.klant?.naam ?? "—"}</span>
          </div>
        ))}
      </Sectie>

      <section>
        <h2 className="text-sm font-semibold text-neutral-700">
          Btw-validatie via VIES <span className="tnum font-normal text-neutral-400">({metBtw.length})</span>
        </h2>
        <p className="mb-2 mt-0.5 text-xs text-neutral-500">
          Officiële EU-controle. Vzw's en scholen zijn vaak niet btw-plichtig — hun ondernemingsnummer is dan
          wél correct, maar niet btw-actief.
        </p>
        <Suspense
          fallback={
            <p className="rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-400">
              Btw-nummers controleren bij VIES…
            </p>
          }
        >
          <ViesSectie items={metBtw} />
        </Suspense>
      </section>

      <Sectie
        titel="Zonder btw-nummer"
        aantal={zonderBtw.length}
        sub="In geen enkel systeem een btw-nummer. Opzoeken kan via KBO of de Peppol-directory (zoekt op klantnaam)."
      >
        {zonderBtw.map((k) => {
          const zoeknaam = k.naam.split(" - ")[0];
          return (
            <div key={k.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5">
              <KlantLink id={k.id} naam={k.naam} />
              <span className="ml-auto inline-flex items-center gap-3 text-xs">
                <a
                  href={`https://kbopub.economie.fgov.be/kbopub/zoeknaamfonetischform.html?searchWord=${encodeURIComponent(zoeknaam)}&_oudeZoekTot=true`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-neutral-500 hover:text-coral-hover"
                >
                  KBO <ExternalLink size={11} />
                </a>
                <a
                  href={`https://directory.peppol.eu/public/locale-en_US/menuitem-search?q=${encodeURIComponent(zoeknaam)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-neutral-500 hover:text-coral-hover"
                >
                  Peppol <ExternalLink size={11} />
                </a>
              </span>
            </div>
          );
        })}
      </Sectie>
    </div>
  );
}
