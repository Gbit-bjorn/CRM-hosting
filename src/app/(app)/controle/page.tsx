import { Suspense } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { db } from "@/lib/db";
import { comanageActief, listContacts, type CoContact } from "@/lib/comanage";
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
};

function Sectie({ titel, sub, children }: { titel: string; sub?: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-1 text-sm font-semibold text-neutral-700">{titel}</h2>
      {sub && <p className="mb-2 text-xs text-neutral-500">{sub}</p>}
      {children}
    </section>
  );
}

const normAdres = (s: string | null | undefined) =>
  (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

function coAdresVan(co: CoContact): string | null {
  const a = co.addresses?.find((x) => x.type === "billing");
  return a?.address_line_1 ? `${a.address_line_1}, ${a.postcode ?? ""} ${a.city ?? ""}`.trim() : null;
}

/** VIES-validatie, gestreamd (VIES is traag) — in beperkte parallelle groepjes. */
async function ViesSectie({ items }: { items: { klant: KlantRij; btw: string }[] }) {
  const resultaten: ({ valid: boolean; name: string | null } | null)[] = [];
  for (let i = 0; i < items.length; i += 5) {
    const chunk = items.slice(i, i + 5);
    resultaten.push(...(await Promise.all(chunk.map((x) => checkVat(x.btw)))));
  }
  const ongeldig = items.filter((_, i) => resultaten[i] && !resultaten[i]!.valid);

  return (
    <div className="space-y-2">
      {ongeldig.length === 0 && (
        <p className="rounded-lg border border-neutral-200 bg-white p-3 text-sm text-neutral-500">
          Geen ongeldige btw-nummers gevonden.
        </p>
      )}
      {items.map((x, i) => {
        const r = resultaten[i];
        return (
          <div key={x.klant.id} className="rounded-lg border border-neutral-200 bg-white p-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <Link href={`/klanten/${x.klant.id}`} className="text-sm font-medium text-neutral-800 hover:text-coral-hover hover:underline">
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
  const klanten: KlantRij[] = await db.klant.findMany({
    orderBy: { naam: "asc" },
    select: { id: true, naam: true, type: true, vatNumber: true, adres: true, comanageId: true },
  });
  const coContacts = comanageActief() ? await listContacts().catch(() => null) : null;
  const coOp = new Map((coContacts ?? []).map((c) => [String(c.number), c]));

  // CRM ↔ CoManage vergelijken — enkel signaleren, nooit automatisch overschrijven.
  type Verschil = {
    klant: KlantRij;
    veld: "vatNumber" | "adres";
    label: string;
    crm: string | null;
    comanage: string | null;
  };
  const verschillen: Verschil[] = [];
  let gekoppeld = 0;
  for (const k of klanten) {
    const co = k.comanageId ? coOp.get(k.comanageId) : undefined;
    if (!co) continue;
    gekoppeld++;
    const crmBtw = normaliseerBtw(k.vatNumber);
    const coBtw = normaliseerBtw(co.vat_number);
    if ((crmBtw || coBtw) && crmBtw !== coBtw)
      verschillen.push({ klant: k, veld: "vatNumber", label: "Btw-nummer", crm: k.vatNumber, comanage: co.vat_number ?? null });
    const coAdres = coAdresVan(co);
    if ((k.adres || coAdres) && normAdres(k.adres) !== normAdres(coAdres))
      verschillen.push({ klant: k, veld: "adres", label: "Adres", crm: k.adres, comanage: coAdres });
  }

  // Btw-nummers voor VIES: CRM eerst, anders CoManage.
  const metBtw = klanten
    .map((k) => ({
      klant: k,
      btw: normaliseerBtw(k.vatNumber) ?? normaliseerBtw(coOp.get(k.comanageId ?? "")?.vat_number),
    }))
    .filter((x): x is { klant: KlantRij; btw: string } => !!x.btw);
  const zonderBtw = klanten.filter(
    (k) => !metBtw.some((x) => x.klant.id === k.id) && k.type !== "intern",
  );

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader title="Controle" />
      <p className="text-sm text-neutral-500">
        Vergelijkt het CRM live met CoManage en valideert btw-nummers bij VIES (de officiële
        EU-databank). Er wordt <strong className="font-medium text-neutral-700">niets automatisch overschreven</strong> —
        jij beslist per veld, en naar CoManage wordt nooit geschreven.
      </p>

      <Sectie
        titel={`CRM ↔ CoManage (${verschillen.length} ${verschillen.length === 1 ? "verschil" : "verschillen"})`}
        sub={
          coContacts === null
            ? "CoManage niet bereikbaar of geen API-key — vergelijking overgeslagen."
            : `${gekoppeld} gekoppelde klanten vergeleken op btw-nummer en adres. Aanpassen in CoManage doe je in CoManage zelf.`
        }
      >
        <div className="space-y-2">
          {verschillen.length === 0 && coContacts !== null && (
            <p className="rounded-lg border border-neutral-200 bg-white p-3 text-sm text-neutral-500">
              Geen verschillen tussen CRM en CoManage.
            </p>
          )}
          {verschillen.map((v) => (
            <div key={`${v.klant.id}-${v.veld}`} className="rounded-lg border border-neutral-200 bg-white p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/klanten/${v.klant.id}`} className="text-sm font-medium text-neutral-800 hover:text-coral-hover hover:underline">
                  {v.klant.naam}
                </Link>
                <Badge soort="warn">{v.label} verschilt</Badge>
              </div>
              <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                <div className="rounded-md bg-neutral-50 px-2.5 py-1.5">
                  <dt className="text-xs text-neutral-400">CRM</dt>
                  <dd className="text-neutral-700">{v.crm ?? <span className="text-neutral-400">— leeg —</span>}</dd>
                </div>
                <div className="rounded-md bg-neutral-50 px-2.5 py-1.5">
                  <dt className="text-xs text-neutral-400">CoManage</dt>
                  <dd className="text-neutral-700">{v.comanage ?? <span className="text-neutral-400">— leeg —</span>}</dd>
                </div>
              </dl>
              {v.comanage && (
                <div className="mt-2">
                  <OverneemKnop klantId={v.klant.id} veld={v.veld} waarde={v.comanage} />
                </div>
              )}
            </div>
          ))}
        </div>
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
          {zonderBtw.map((k) => {
            const zoeknaam = k.naam.split(" - ")[0];
            return (
              <div key={k.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm">
                <Link href={`/klanten/${k.id}`} className="font-medium text-neutral-800 hover:text-coral-hover hover:underline">
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
