import { Suspense } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { db } from "@/lib/db";
import { comanageActief, listContacts, type CoContact } from "@/lib/comanage";
import { listClients, type NomeoClient } from "@/lib/nomeo";
import { checkVat, normaliseerBtw } from "@/lib/vies";
import { isEigenFacturatie } from "@/lib/billing";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { StatusDot } from "@/components/ui/StatusDot";
import OverneemKnop from "@/components/OverneemKnop";

export const dynamic = "force-dynamic";

type KlantRij = {
  id: string;
  naam: string;
  type: string;
  vatNumber: string | null;
  adres: string | null;
  comanageId: string | null;
  nomeoId: string | null;
};

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

const normAdres = (s: string | null | undefined) =>
  (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

function coAdresVan(co: CoContact | undefined): string | null {
  const a = co?.addresses?.find((x) => x.type === "billing");
  return a?.address_line_1 ? `${a.address_line_1}, ${a.postcode ?? ""} ${a.city ?? ""}`.trim() : null;
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
    comanageActief() ? listContacts().catch(() => null) : Promise.resolve(null),
    listClients().catch(() => null as NomeoClient[] | null),
    db.factuurMoment.findMany({
      where: { status: "te_doen" },
      select: { bedrag: true, abonnement: { select: { klantId: true, renewalDate: true } } },
    }),
  ]);
  const coOp = new Map((coContacts ?? []).map((c) => [String(c.number), c]));
  const nomeoOp = new Map((nomeoKlanten ?? []).map((c) => [c.id, c]));

  type Conflict = {
    klant: KlantRij;
    veld: "vatNumber" | "adres";
    label: string;
    waarden: { bron: string; waarde: string }[];
  };
  type AanTeVullen = Conflict["waarden"][0] & {
    klant: KlantRij;
    veld: "vatNumber" | "adres";
    label: string;
  };
  const conflicten: Conflict[] = [];
  const aanTeVullen: AanTeVullen[] = [];

  for (const k of klanten) {
    const co = k.comanageId ? coOp.get(k.comanageId) : undefined;
    const no = k.nomeoId ? nomeoOp.get(k.nomeoId) : undefined;

    const btwBronnen = [
      { bron: "CRM", waarde: k.vatNumber },
      { bron: "Nomeo", waarde: no?.vat_number || null },
      { bron: "CoManage", waarde: co?.vat_number || null },
    ].filter((b): b is { bron: string; waarde: string } => !!b.waarde);
    const btwUniek = new Set(btwBronnen.map((b) => normaliseerBtw(b.waarde) ?? b.waarde));
    if (btwUniek.size > 1) {
      conflicten.push({ klant: k, veld: "vatNumber", label: "btw-nummer", waarden: btwBronnen });
    } else if (!k.vatNumber && btwBronnen.length > 0) {
      aanTeVullen.push({ klant: k, veld: "vatNumber", label: "btw-nummer", ...btwBronnen[0] });
    }

    const coAdres = coAdresVan(co);
    if (k.adres && coAdres && normAdres(k.adres) !== normAdres(coAdres)) {
      conflicten.push({
        klant: k,
        veld: "adres",
        label: "adres",
        waarden: [
          { bron: "CRM", waarde: k.adres },
          { bron: "CoManage", waarde: coAdres },
        ],
      });
    } else if (!k.adres && coAdres) {
      aanTeVullen.push({ klant: k, veld: "adres", label: "adres", bron: "CoManage", waarde: coAdres });
    }
  }

  // Open te factureren per klant → bepaalt wie prioritair in CoManage moet.
  const openPerKlant = new Map<string, { bedrag: number; regels: number }>();
  for (const m of openMomenten) {
    if (!isEigenFacturatie(m.abonnement.renewalDate)) continue;
    const t = openPerKlant.get(m.abonnement.klantId) ?? { bedrag: 0, regels: 0 };
    t.bedrag += m.bedrag;
    t.regels += 1;
    openPerKlant.set(m.abonnement.klantId, t);
  }
  const nietGekoppeld = klanten
    .filter((k) => !k.comanageId && k.type !== "intern")
    .map((k) => ({ ...k, open: openPerKlant.get(k.id) ?? { bedrag: 0, regels: 0 } }))
    .sort((a, b) => b.open.bedrag - a.open.bedrag);

  const metBtw = klanten
    .map((k) => ({
      klant: k,
      btw:
        normaliseerBtw(k.vatNumber) ??
        normaliseerBtw(nomeoOp.get(k.nomeoId ?? "")?.vat_number) ??
        normaliseerBtw(coOp.get(k.comanageId ?? "")?.vat_number),
    }))
    .filter((x): x is { klant: KlantRij; btw: string } => !!x.btw);
  const zonderBtw = klanten.filter(
    (k) => !metBtw.some((x) => x.klant.id === k.id) && k.type !== "intern",
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
