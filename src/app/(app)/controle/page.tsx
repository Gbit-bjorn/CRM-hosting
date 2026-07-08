import { Suspense } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { db } from "@/lib/db";
import { comanageActief, listContacts, type CoContact } from "@/lib/comanage";
import { listClients, type NomeoClient } from "@/lib/nomeo";
import { checkVat, normaliseerBtw } from "@/lib/vies";
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

function Sectie({
  titel,
  sub,
  children,
}: {
  titel: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-1 text-sm font-semibold text-neutral-700">{titel}</h2>
      {sub && <p className="mb-2 text-xs text-neutral-500">{sub}</p>}
      {children}
    </section>
  );
}

function LeegMelding({ tekst }: { tekst: string }) {
  return (
    <p className="rounded-lg border border-neutral-200 bg-white p-3 text-sm text-neutral-500">{tekst}</p>
  );
}

const normAdres = (s: string | null | undefined) =>
  (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

function coAdresVan(co: CoContact | undefined): string | null {
  const a = co?.addresses?.find((x) => x.type === "billing");
  return a?.address_line_1 ? `${a.address_line_1}, ${a.postcode ?? ""} ${a.city ?? ""}`.trim() : null;
}

/** VIES-validatie, gestreamd (VIES is traag) — in beperkte parallelle groepjes. */
async function ViesSectie({ items }: { items: { klant: KlantRij; btw: string }[] }) {
  const resultaten: ({ valid: boolean; name: string | null } | null)[] = [];
  for (let i = 0; i < items.length; i += 5) {
    const chunk = items.slice(i, i + 5);
    resultaten.push(...(await Promise.all(chunk.map((x) => checkVat(x.btw)))));
  }
  return (
    <div className="space-y-2">
      {items.map((x, i) => {
        const r = resultaten[i];
        return (
          <div key={x.klant.id} className="rounded-lg border border-neutral-200 bg-white p-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <Link
                href={`/klanten/${x.klant.id}`}
                className="text-sm font-medium text-neutral-800 hover:text-coral-hover hover:underline"
              >
                {x.klant.naam}
              </Link>
              <span className="tnum text-sm text-neutral-600">{x.btw}</span>
              <span className="ml-auto">
                {r === null ? (
                  <StatusDot tone="idle">VIES gaf geen antwoord</StatusDot>
                ) : r.valid ? (
                  <StatusDot tone="ok">btw-actief</StatusDot>
                ) : (
                  <StatusDot tone="warn">niet btw-actief volgens VIES</StatusDot>
                )}
              </span>
            </div>
            {r?.valid && r.name && (
              <p className="mt-1 text-xs text-neutral-500">Officiële naam (VIES): {r.name}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default async function Controle() {
  const [klanten, losseDomeinen, coContacts, nomeoKlanten] = await Promise.all([
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
  ]);
  const coOp = new Map((coContacts ?? []).map((c) => [String(c.number), c]));
  const nomeoOp = new Map((nomeoKlanten ?? []).map((c) => [c.id, c]));

  // Per klant en per veld de drie bronnen naast elkaar leggen.
  type Conflict = {
    klant: KlantRij;
    veld: "vatNumber" | "adres";
    label: string;
    waarden: { bron: string; waarde: string }[];
  };
  type AanTeVullen = {
    klant: KlantRij;
    veld: "vatNumber" | "adres";
    label: string;
    bron: string;
    waarde: string;
  };
  const conflicten: Conflict[] = [];
  const aanTeVullen: AanTeVullen[] = [];

  for (const k of klanten) {
    const co = k.comanageId ? coOp.get(k.comanageId) : undefined;
    const no = k.nomeoId ? nomeoOp.get(k.nomeoId) : undefined;

    // Btw-nummer: CRM · Nomeo · CoManage
    const btwBronnen = [
      { bron: "CRM", waarde: k.vatNumber },
      { bron: "Nomeo", waarde: no?.vat_number || null },
      { bron: "CoManage", waarde: co?.vat_number || null },
    ].filter((b): b is { bron: string; waarde: string } => !!b.waarde);
    const btwUniek = new Set(btwBronnen.map((b) => normaliseerBtw(b.waarde) ?? b.waarde));
    if (btwUniek.size > 1) {
      conflicten.push({ klant: k, veld: "vatNumber", label: "Btw-nummer", waarden: btwBronnen });
    } else if (!k.vatNumber && btwBronnen.length > 0) {
      aanTeVullen.push({
        klant: k,
        veld: "vatNumber",
        label: "Btw-nummer",
        bron: btwBronnen[0].bron,
        waarde: btwBronnen[0].waarde,
      });
    }

    // Adres: CRM · CoManage (Nomeo levert geen adres)
    const coAdres = coAdresVan(co);
    if (k.adres && coAdres && normAdres(k.adres) !== normAdres(coAdres)) {
      conflicten.push({
        klant: k,
        veld: "adres",
        label: "Adres",
        waarden: [
          { bron: "CRM", waarde: k.adres },
          { bron: "CoManage", waarde: coAdres },
        ],
      });
    } else if (!k.adres && coAdres) {
      aanTeVullen.push({ klant: k, veld: "adres", label: "Adres", bron: "CoManage", waarde: coAdres });
    }
  }

  const nietGekoppeld = klanten.filter((k) => !k.comanageId && k.type !== "intern");

  // Btw-nummers voor VIES: CRM eerst, anders een bron.
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

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader title="Controle" />
      <p className="text-sm text-neutral-500">
        Legt CRM, Nomeo en CoManage live naast elkaar en valideert btw-nummers bij VIES.{" "}
        <strong className="font-medium text-neutral-700">Er wordt niets automatisch overschreven</strong> —
        jij beslist per veld; naar Nomeo of CoManage wordt nooit geschreven. Klik een klant aan voor de
        volledige bronvergelijking.
      </p>

      <Sectie
        titel={`Bronconflicten (${conflicten.length})`}
        sub={`De systemen spreken elkaar tegen. ${coContacts === null ? "⚠ CoManage was niet bereikbaar. " : ""}${nomeoKlanten === null ? "⚠ Nomeo was niet bereikbaar. " : ""}`}
      >
        <div className="space-y-2">
          {conflicten.length === 0 && <LeegMelding tekst="Geen tegenstrijdige waarden gevonden." />}
          {conflicten.map((c) => (
            <div key={`${c.klant.id}-${c.veld}`} className="rounded-lg border border-neutral-200 bg-white p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/klanten/${c.klant.id}`}
                  className="text-sm font-medium text-neutral-800 hover:text-coral-hover hover:underline"
                >
                  {c.klant.naam}
                </Link>
                <Badge soort="warn">{c.label} verschilt</Badge>
              </div>
              <dl className={`mt-2 grid gap-2 text-sm ${c.waarden.length >= 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
                {c.waarden.map((w) => (
                  <div key={w.bron} className="rounded-md bg-neutral-50 px-2.5 py-1.5">
                    <dt className="text-xs text-neutral-400">{w.bron}</dt>
                    <dd className="break-words text-neutral-700">{w.waarde}</dd>
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
        </div>
      </Sectie>

      <Sectie
        titel={`Aan te vullen in het CRM (${aanTeVullen.length})`}
        sub="Het CRM is leeg terwijl een bron de waarde kent — geen conflict, wel een gaatje."
      >
        <div className="space-y-1.5">
          {aanTeVullen.length === 0 && <LeegMelding tekst="Niets aan te vullen." />}
          {aanTeVullen.map((a) => (
            <div
              key={`${a.klant.id}-${a.veld}`}
              className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm"
            >
              <Link
                href={`/klanten/${a.klant.id}`}
                className="font-medium text-neutral-800 hover:text-coral-hover hover:underline"
              >
                {a.klant.naam}
              </Link>
              <span className="text-neutral-500">
                {a.label}: <span className="text-neutral-700">{a.waarde}</span>{" "}
                <span className="text-neutral-400">({a.bron})</span>
              </span>
              <span className="ml-auto">
                <OverneemKnop klantId={a.klant.id} veld={a.veld} waarde={a.waarde} />
              </span>
            </div>
          ))}
        </div>
      </Sectie>

      <Sectie
        titel={`Niet in CoManage (${nietGekoppeld.length})`}
        sub="Nog geen klant in de boekhouding — handmatig aanmaken in CoManage vóór je factureert (daarna opnieuw koppelen)."
      >
        {nietGekoppeld.length === 0 ? (
          <LeegMelding tekst="Alle klanten zijn gekoppeld." />
        ) : (
          <div className="rounded-lg border border-neutral-200 bg-white p-3 text-sm text-neutral-700">
            {nietGekoppeld.map((k, i) => (
              <span key={k.id}>
                {i > 0 && <span className="text-neutral-300"> · </span>}
                <Link href={`/klanten/${k.id}`} className="hover:text-coral-hover hover:underline">
                  {k.naam}
                </Link>
              </span>
            ))}
          </div>
        )}
      </Sectie>

      <Sectie
        titel={`Domeinen buiten Nomeo (${losseDomeinen.length})`}
        sub="Niet in het Nomeo-portfolio — de vervaldatum komt uit de oude Plesk-export en wordt níét ververst. Uitzoeken waar deze geregistreerd zijn."
      >
        {losseDomeinen.length === 0 ? (
          <LeegMelding tekst="Alle domeinen zitten in Nomeo." />
        ) : (
          <div className="space-y-1.5">
            {losseDomeinen.map((d) => (
              <div
                key={d.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm"
              >
                <Link
                  href={`/domeinen/${d.id}`}
                  className="font-medium text-neutral-800 hover:text-coral-hover hover:underline"
                >
                  {d.naam}
                </Link>
                <span className="text-neutral-500">{d.klant?.naam ?? "—"}</span>
                <span className="tnum ml-auto text-xs text-neutral-500">
                  {d.expireDate ? `Plesk-datum: ${d.expireDate.toISOString().slice(0, 10)}` : "geen datum"}
                </span>
              </div>
            ))}
          </div>
        )}
      </Sectie>

      <Sectie
        titel={`Btw-validatie via VIES (${metBtw.length})`}
        sub="Officiële EU-controle; kan enkele seconden duren. Let op: vzw's en scholen zijn vaak niet btw-plichtig — hun ondernemingsnummer is dan wél correct, maar niet btw-actief."
      >
        <Suspense
          fallback={
            <p className="rounded-lg border border-neutral-200 bg-white p-3 text-sm text-neutral-400">
              Btw-nummers controleren bij VIES…
            </p>
          }
        >
          <ViesSectie items={metBtw} />
        </Suspense>
      </Sectie>

      <Sectie
        titel={`Zonder btw-nummer (${zonderBtw.length})`}
        sub="Opzoeken kan via KBO Public Search of de Peppol-directory (link zoekt op de klantnaam)."
      >
        <div className="space-y-1.5">
          {zonderBtw.length === 0 && <LeegMelding tekst="Elke klant heeft een btw-nummer." />}
          {zonderBtw.map((k) => {
            const zoeknaam = k.naam.split(" - ")[0];
            return (
              <div
                key={k.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm"
              >
                <Link
                  href={`/klanten/${k.id}`}
                  className="font-medium text-neutral-800 hover:text-coral-hover hover:underline"
                >
                  {k.naam}
                </Link>
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
        </div>
      </Sectie>
    </div>
  );
}
