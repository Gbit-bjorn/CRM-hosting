"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, Copy } from "lucide-react";
import { ontbreekt, type CoManageRij } from "@/lib/ronde";
import { PageHeader } from "@/components/ui/PageHeader";

const eur = (n: number) => "€ " + n.toLocaleString("nl-BE");

/** Eén blok tekst dat je in CoManage kan plakken. */
function alsTekst(r: CoManageRij) {
  return [
    r.naam,
    r.btw && `Btw: ${r.btw}`,
    r.adres && `Adres: ${r.adres}`,
    r.contact && `Contact: ${r.contact}`,
    r.email && `E-mail: ${r.email}`,
    r.telefoon && `Tel: ${r.telefoon}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function Veld({ waarde, bron, mist }: { waarde: string; bron: string; mist: string }) {
  if (!waarde) return <span className="text-bad-text">{mist}</span>;
  return (
    <span>
      {waarde}
      {bron === "Nomeo" && (
        <span className="ml-1.5 rounded bg-warn-bg px-1 py-0.5 text-[10px] font-medium text-warn-text">
          uit Nomeo
        </span>
      )}
    </span>
  );
}

export default function ComanageLijst({
  rijen,
  nomeoBereikbaar,
}: {
  rijen: CoManageRij[];
  nomeoBereikbaar: boolean;
}) {
  const router = useRouter();
  const [nummers, setNummers] = useState<Record<string, string>>({});
  const [bezig, setBezig] = useState<string | null>(null);
  const [gekopieerd, setGekopieerd] = useState<string | null>(null);
  const [alleen, setAlleen] = useState<"alle" | "volledig" | "onvolledig">("alle");

  const volledig = rijen.filter((r) => ontbreekt(r).length === 0);
  const zichtbaar =
    alleen === "volledig" ? volledig
    : alleen === "onvolledig" ? rijen.filter((r) => ontbreekt(r).length > 0)
    : rijen;

  async function bewaar(id: string) {
    const comanageId = (nummers[id] ?? "").trim();
    if (!comanageId) return;
    setBezig(id);
    await fetch("/api/ronde", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actie: "comanage-id", klantId: id, comanageId }),
    });
    setBezig(null);
    router.refresh();
  }

  async function kopieer(r: CoManageRij) {
    try {
      await navigator.clipboard.writeText(alsTekst(r));
      setGekopieerd(r.id);
      setTimeout(() => setGekopieerd((v) => (v === r.id ? null : v)), 1500);
    } catch {
      setGekopieerd(null);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Aan te maken in CoManage" count={rijen.length}>
        <Link
          href="/facturatieronde"
          className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-sm text-neutral-600 transition hover:bg-neutral-50"
        >
          <ArrowLeft size={14} /> Terug naar de ronde
        </Link>
      </PageHeader>

      <p className="text-sm text-neutral-600">
        Maak de klant aan in CoManage en vul hier het klantnummer in. De klant verdwijnt dan uit deze
        lijst en het CoManage-punt in de facturatieronde wordt groen. Het CRM schrijft nooit zelf naar
        CoManage.
      </p>

      {!nomeoBereikbaar && (
        <p className="rounded-md border border-warn-text/25 bg-warn-bg px-3 py-2 text-sm text-warn-text">
          Nomeo was niet bereikbaar — ontbrekende btw-nummers en adressen konden niet aangevuld worden.
        </p>
      )}

      <div className="flex flex-wrap gap-1">
        {(
          [
            ["alle", `Alle (${rijen.length})`],
            ["volledig", `Meteen invulbaar (${volledig.length})`],
            ["onvolledig", `Gegevens ontbreken (${rijen.length - volledig.length})`],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setAlleen(k)}
            className={`rounded px-2.5 py-1 text-xs font-medium transition ${
              alleen === k
                ? "bg-charcoal text-white"
                : "border border-neutral-200 text-neutral-600 hover:bg-neutral-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {zichtbaar.map((r) => {
          const mist = ontbreekt(r);
          return (
            <section key={r.id} className="rounded-lg border border-neutral-200 bg-white">
              <div className="flex flex-wrap items-center gap-2 border-b border-neutral-100 px-4 py-2.5">
                <h2 className="flex-1 text-sm font-semibold text-charcoal">{r.naam}</h2>
                {r.publiek && (
                  <span className="rounded bg-warn-bg px-1.5 py-0.5 text-[10px] font-medium text-warn-text">
                    leveranciersregistratie nakijken
                  </span>
                )}
                {r.openRegels > 0 && (
                  <span className="tnum text-xs text-neutral-500">
                    {eur(r.openBedrag)} open · {r.openRegels} regels
                  </span>
                )}
                <button
                  onClick={() => kopieer(r)}
                  className="inline-flex items-center gap-1 rounded border border-neutral-200 px-2 py-0.5 text-[11px] text-neutral-600 transition hover:bg-neutral-50"
                >
                  {gekopieerd === r.id ? <Check size={11} /> : <Copy size={11} />}
                  {gekopieerd === r.id ? "gekopieerd" : "kopieer gegevens"}
                </button>
              </div>

              <dl className="grid grid-cols-1 gap-x-6 gap-y-1 px-4 py-3 text-xs sm:grid-cols-2">
                <div className="flex gap-2">
                  <dt className="w-20 flex-none text-neutral-500">Btw</dt>
                  <dd className="min-w-0"><Veld waarde={r.btw} bron={r.btwBron} mist="ontbreekt" /></dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-20 flex-none text-neutral-500">Contact</dt>
                  <dd className="min-w-0">{r.contact || <span className="text-bad-text">ontbreekt</span>}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-20 flex-none text-neutral-500">Adres</dt>
                  <dd className="min-w-0"><Veld waarde={r.adres} bron={r.adresBron} mist="ontbreekt" /></dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-20 flex-none text-neutral-500">E-mail</dt>
                  <dd className="min-w-0 break-all">
                    {r.email || <span className="text-bad-text">ontbreekt</span>}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-20 flex-none text-neutral-500">Telefoon</dt>
                  <dd className="min-w-0">{r.telefoon || <span className="text-neutral-400">—</span>}</dd>
                </div>
              </dl>

              <div className="flex flex-wrap items-center gap-2 border-t border-neutral-100 px-4 py-2.5">
                {mist.length > 0 && (
                  <span className="text-xs text-bad-text">
                    Eerst opvragen: {mist.join(", ")}
                  </span>
                )}
                <div className="ml-auto flex items-center gap-2">
                  <label htmlFor={`cm-${r.id}`} className="text-xs text-neutral-500">
                    CoManage-klantnummer
                  </label>
                  <input
                    id={`cm-${r.id}`}
                    value={nummers[r.id] ?? ""}
                    onChange={(e) => setNummers((v) => ({ ...v, [r.id]: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && bewaar(r.id)}
                    placeholder="bv. 57"
                    className="w-24 rounded-md border border-neutral-200 px-2 py-1 text-xs outline-none focus:border-neutral-300 focus:ring-2 focus:ring-coral/15"
                  />
                  <button
                    disabled={!(nummers[r.id] ?? "").trim() || bezig === r.id}
                    onClick={() => bewaar(r.id)}
                    className="rounded-md bg-charcoal px-2.5 py-1 text-xs font-medium text-white transition hover:bg-charcoal-light disabled:opacity-40"
                  >
                    {bezig === r.id ? "bewaren…" : "Bewaren"}
                  </button>
                </div>
              </div>
            </section>
          );
        })}

        {zichtbaar.length === 0 && (
          <p className="rounded-lg border border-neutral-200 bg-white px-4 py-8 text-center text-sm text-neutral-400">
            Niets meer te doen hier.
          </p>
        )}
      </div>
    </div>
  );
}
