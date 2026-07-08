import { Badge } from "@/components/ui/Badge";
import OverneemKnop from "@/components/OverneemKnop";
import { normaliseerBtw } from "@/lib/vies";
import type { CoContact } from "@/lib/comanage";
import type { NomeoClient } from "@/lib/nomeo";

// Vergelijkt de klantgegevens per bron (CRM · Nomeo · CoManage) en toont per
// veld of de bronnen overeenkomen. Alleen-lezen richting de externe systemen;
// overnemen in het CRM gebeurt per veld en expliciet.

type KlantVeldWaarden = {
  id: string;
  naam: string;
  vatNumber: string | null;
  adres: string | null;
};

const normTekst = (s: string | null) => (s ?? "").toLowerCase().replace(/[^a-z0-9@]/g, "");

function oordeel(waarden: (string | null | undefined)[]) {
  const aanwezig = waarden.filter((w): w is string => !!w && w.trim() !== "");
  const uniek = new Set(aanwezig.map((w) => normTekst(w)));
  if (aanwezig.length === 0) return null;
  if (uniek.size > 1) return { soort: "warn" as const, label: "verschilt" };
  if (aanwezig.length === 1) return { soort: "idle" as const, label: "slechts 1 bron" };
  return { soort: "ok" as const, label: "gelijk" };
}

function Waarde({ bron, waarde, email }: { bron: string; waarde: string | null | undefined; email?: boolean }) {
  return (
    <div className="rounded-md bg-neutral-50 px-2.5 py-1.5">
      <dt className="text-xs text-neutral-400">{bron}</dt>
      <dd className="break-words text-sm text-neutral-700">
        {waarde ? (
          email ? (
            <a href={`mailto:${waarde}`} className="text-coral-hover hover:underline">
              {waarde}
            </a>
          ) : (
            waarde
          )
        ) : (
          <span className="text-neutral-300">—</span>
        )}
      </dd>
    </div>
  );
}

function VeldRij({
  label,
  badge,
  kinderen,
  acties,
}: {
  label: string;
  badge: { soort: "ok" | "warn" | "idle"; label: string } | null;
  kinderen: React.ReactNode;
  acties?: React.ReactNode;
}) {
  return (
    <div className="border-b border-neutral-100 py-3 first:pt-0 last:border-0 last:pb-0">
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</span>
        {badge && <Badge soort={badge.soort}>{badge.label}</Badge>}
      </div>
      <dl className="grid gap-2 sm:grid-cols-3">{kinderen}</dl>
      {acties && <div className="mt-2 flex flex-wrap gap-2">{acties}</div>}
    </div>
  );
}

export default function BronVergelijking({
  klant,
  nomeo,
  comanage,
}: {
  klant: KlantVeldWaarden;
  nomeo: NomeoClient | null;
  comanage: CoContact | null;
}) {
  const nomeoNaam = nomeo ? nomeo.company?.trim() || `${nomeo.firstname} ${nomeo.lastname}`.trim() : null;
  const coAdresObj = comanage?.addresses?.find((a) => a.type === "billing");
  const coAdres = coAdresObj?.address_line_1
    ? `${coAdresObj.address_line_1}, ${coAdresObj.postcode ?? ""} ${coAdresObj.city ?? ""}`.trim()
    : null;

  const crmBtw = klant.vatNumber;
  const nomeoBtw = nomeo?.vat_number || null;
  const coBtw = comanage?.vat_number || null;

  const btwOordeel = (() => {
    const aanwezig = [crmBtw, nomeoBtw, coBtw].filter((w): w is string => !!w);
    const uniek = new Set(aanwezig.map((w) => normaliseerBtw(w) ?? w));
    if (aanwezig.length === 0) return null;
    if (uniek.size > 1) return { soort: "warn" as const, label: "verschilt" };
    if (aanwezig.length === 1) return { soort: "idle" as const, label: "slechts 1 bron" };
    return { soort: "ok" as const, label: "gelijk" };
  })();

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-neutral-700">
        Bronvergelijking <span className="font-normal text-neutral-400">CRM · Nomeo · CoManage</span>
      </h2>

      <VeldRij label="Naam" badge={{ soort: "idle", label: "ter info" }} kinderen={
        <>
          <Waarde bron="CRM" waarde={klant.naam} />
          <Waarde bron="Nomeo" waarde={nomeoNaam} />
          <Waarde bron="CoManage" waarde={comanage?.name} />
        </>
      } />

      <VeldRij
        label="Btw-nummer"
        badge={btwOordeel}
        kinderen={
          <>
            <Waarde bron="CRM" waarde={crmBtw} />
            <Waarde bron="Nomeo" waarde={nomeoBtw} />
            <Waarde bron="CoManage" waarde={coBtw} />
          </>
        }
        acties={
          <>
            {nomeoBtw && normaliseerBtw(nomeoBtw) !== normaliseerBtw(crmBtw) && (
              <OverneemKnop klantId={klant.id} veld="vatNumber" waarde={nomeoBtw} label="Neem Nomeo-waarde over" />
            )}
            {coBtw && normaliseerBtw(coBtw) !== normaliseerBtw(crmBtw) && (
              <OverneemKnop klantId={klant.id} veld="vatNumber" waarde={coBtw} label="Neem CoManage-waarde over" />
            )}
          </>
        }
      />

      <VeldRij
        label="Adres"
        badge={oordeel([klant.adres, coAdres])}
        kinderen={
          <>
            <Waarde bron="CRM" waarde={klant.adres} />
            <Waarde bron="Nomeo" waarde={null} />
            <Waarde bron="CoManage" waarde={coAdres} />
          </>
        }
        acties={
          coAdres && normTekst(coAdres) !== normTekst(klant.adres) ? (
            <OverneemKnop klantId={klant.id} veld="adres" waarde={coAdres} label="Neem CoManage-waarde over" />
          ) : undefined
        }
      />

      <VeldRij
        label="E-mail"
        badge={oordeel([nomeo?.email ?? null, comanage?.email ?? null])}
        kinderen={
          <>
            <Waarde bron="CRM" waarde={null} />
            <Waarde bron="Nomeo" waarde={nomeo?.email} email />
            <Waarde bron="CoManage" waarde={comanage?.email} email />
          </>
        }
      />

      {comanage?.phone && (
        <VeldRij label="Telefoon" badge={{ soort: "idle", label: "slechts 1 bron" }} kinderen={
          <>
            <Waarde bron="CRM" waarde={null} />
            <Waarde bron="Nomeo" waarde={null} />
            <Waarde bron="CoManage" waarde={comanage.phone} />
          </>
        } />
      )}

      <p className="mt-3 text-xs text-neutral-400">
        {comanage?.customer_number ? `CoManage-klantnummer ${comanage.customer_number} · ` : ""}
        Nomeo en CoManage zijn alleen-lezen — overnemen wijzigt enkel het CRM, nooit de bron.
      </p>
    </section>
  );
}
