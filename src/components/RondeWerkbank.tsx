"use client";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, ChevronLeft, ChevronRight, ClipboardList, Plus, RotateCw } from "lucide-react";
import {
  eigenSleutel,
  legeStand,
  type BlokId,
  type Dossier,
  type Punt,
  type Stand,
} from "@/lib/ronde";
import RondePunt, { statusVanPunt, vraagtActie } from "@/components/RondePunt";
import { PageHeader } from "@/components/ui/PageHeader";
import { SearchInput } from "@/components/ui/SearchInput";

const PIP: Record<"open" | "bezig" | "klaar", string> = {
  open: "bg-neutral-200",
  bezig: "bg-warn-text",
  klaar: "bg-ok-text",
};

const dt = (iso: string) =>
  new Date(iso).toLocaleString("nl-BE", { dateStyle: "short", timeStyle: "short" });
const kort = (m: string) => m.split("@")[0];

export default function RondeWerkbank({
  dossiers,
  standen: initieel,
  onbereikbaar,
  ikBen,
}: {
  dossiers: Dossier[];
  standen: Record<string, Stand>;
  onbereikbaar: string[];
  ikBen: string;
}) {
  const router = useRouter();
  const [standen, setStanden] = useState(initieel);
  const [huidig, setHuidig] = useState(dossiers[0]?.id ?? "");
  const [filter, setFilter] = useState<"alle" | "tedoen" | "bezig" | "klaar">("alle");
  const [zoek, setZoek] = useState("");
  const [nieuwIn, setNieuwIn] = useState<BlokId | null>(null);
  const [nieuwTitel, setNieuwTitel] = useState("");
  const [vernieuwt, setVernieuwt] = useState(false);
  const notTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stand = (id: string): Stand => standen[id] ?? legeStand();

  async function stuur(body: Record<string, unknown>, lokaal: (s: Stand) => Stand) {
    const klantId = body.klantId as string;
    setStanden((v) => ({ ...v, [klantId]: lokaal(v[klantId] ?? legeStand()) }));
    const res = await fetch("/api/ronde", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) router.refresh();
  }

  /** Past de stand van één punt aan; leeg resultaat verdwijnt uit de map. */
  const metPunt = (s: Stand, sleutel: string, wijzig: (p: Stand["punten"][string]) => Stand["punten"][string]): Stand => {
    const nieuw = wijzig(s.punten[sleutel] ?? {});
    const punten = { ...s.punten };
    if (Object.keys(nieuw).length === 0) delete punten[sleutel];
    else punten[sleutel] = nieuw;
    return { ...s, punten };
  };

  /** Eigen punten van deze klant, als gewone punten in hun blok. */
  function puntenVan(d: Dossier, blok: BlokId): { punt: Punt; eigen: boolean }[] {
    const vast = (d.blokken.find((b) => b.id === blok)?.punten ?? []).map((punt) => ({ punt, eigen: false }));
    const eigen = stand(d.id)
      .eigen.filter((e) => e.blok === blok)
      .map((e) => ({
        punt: {
          sleutel: eigenSleutel(e.id),
          titel: e.titel,
          bijschrift: "eigen punt",
          uitleg: [`Toegevoegd door ${kort(e.door)} op ${dt(e.op)}.`],
          toon: "warn" as const,
          open: true,
        },
        eigen: true,
      }));
    return [...vast, ...eigen];
  }

  const telActie = (d: Dossier) =>
    (["nomeo", "gegevens", "comanage", "factuur"] as BlokId[]).reduce(
      (t, b) =>
        t +
        puntenVan(d, b).filter(({ punt }) =>
          vraagtActie(statusVanPunt(punt, stand(d.id).punten[punt.sleutel])),
        ).length,
      0,
    );
  const telAlles = (d: Dossier) =>
    (["nomeo", "gegevens", "comanage", "factuur"] as BlokId[]).reduce(
      (t, b) => t + puntenVan(d, b).length,
      0,
    );

  const zichtbaar = useMemo(() => {
    const q = zoek.trim().toLowerCase();
    return dossiers.filter((d) => {
      if (q) {
        const hooi = (
          d.naam + " " + d.blokken.flatMap((b) => b.punten.map((p) => p.titel)).join(" ")
        ).toLowerCase();
        if (!hooi.includes(q)) return false;
      }
      const af = !!stand(d.id).afgewerkt;
      if (filter === "klaar") return af;
      if (filter === "tedoen") return !af && telActie(d) > 0;
      if (filter === "bezig") return !af && telActie(d) === 0;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dossiers, standen, filter, zoek]);

  const d = dossiers.find((x) => x.id === huidig) ?? dossiers[0];
  const idx = dossiers.findIndex((x) => x.id === d?.id);
  const klaarTotaal = dossiers.filter((x) => stand(x.id).afgewerkt).length;

  if (!d) return <p className="text-sm text-neutral-500">Geen klanten gevonden.</p>;
  const s = stand(d.id);

  function voegEigenToe(blok: BlokId) {
    const titel = nieuwTitel.trim();
    if (!titel) return;
    const id = crypto.randomUUID();
    stuur({ actie: "eigen-toevoegen", klantId: d.id, id, blok, titel }, (v) => ({
      ...v,
      eigen: [...v.eigen, { id, blok, titel, door: ikBen, op: new Date().toISOString() }],
    }));
    setNieuwIn(null);
    setNieuwTitel("");
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Facturatieronde" count={dossiers.length}>
        <span className="tnum text-sm text-neutral-500">
          {klaarTotaal} van {dossiers.length} klanten afgewerkt
        </span>
        <Link
          href="/facturatieronde/comanage"
          className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-sm text-neutral-600 transition hover:bg-neutral-50"
        >
          <ClipboardList size={14} /> Aan te maken in CoManage
        </Link>
        <button
          onClick={() => {
            setVernieuwt(true);
            router.refresh();
            setTimeout(() => setVernieuwt(false), 1200);
          }}
          className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-sm text-neutral-600 transition hover:bg-neutral-50"
        >
          <RotateCw size={14} className={vernieuwt ? "animate-spin" : ""} /> Vernieuwen
        </button>
      </PageHeader>

      {onbereikbaar.length > 0 && (
        <p className="rounded-md border border-warn-text/25 bg-warn-bg px-3 py-2 text-sm text-warn-text">
          {onbereikbaar.join(" en ")} was niet bereikbaar — de vergelijking met die bron is
          onvolledig. Vernieuw straks opnieuw.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        {/* ---- werklijst ---- */}
        <aside className="flex flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)]">
          <div className="border-b border-neutral-200 p-2">
            <SearchInput value={zoek} onChange={setZoek} placeholder="Klant of domein" />
          </div>
          <div className="flex flex-wrap gap-1 border-b border-neutral-200 p-2">
            {(
              [
                ["alle", "Alle"],
                ["tedoen", "Nog open"],
                ["bezig", "Alles opgelost"],
                ["klaar", "Afgewerkt"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setFilter(k)}
                className={`rounded px-2 py-1 text-xs font-medium transition ${
                  filter === k
                    ? "bg-charcoal text-white"
                    : "border border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="max-h-[46vh] overflow-y-auto lg:max-h-none lg:flex-1">
            {zichtbaar.length === 0 && (
              <p className="p-4 text-center text-xs text-neutral-400">Geen klant komt overeen.</p>
            )}
            {zichtbaar.map((k) => {
              const open = telActie(k);
              const af = !!stand(k.id).afgewerkt;
              return (
                <button
                  key={k.id}
                  onClick={() => setHuidig(k.id)}
                  className={`flex w-full items-center gap-2 border-b border-neutral-100 px-3 py-2 text-left transition ${
                    k.id === d.id ? "bg-coral-tint" : "hover:bg-neutral-50"
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate text-xs font-medium ${
                        af ? "text-neutral-400 line-through" : "text-charcoal"
                      }`}
                    >
                      {k.naam}
                    </span>
                    <span className="tnum block text-[11px] text-neutral-500">
                      {af ? "afgewerkt" : open > 0 ? `${open} nog open` : "alles opgelost"}
                    </span>
                  </span>
                  <span className="flex flex-none gap-0.5">
                    {(["nomeo", "gegevens", "comanage", "factuur"] as BlokId[]).map((b) => {
                      const lijst = puntenVan(k, b);
                      const o = lijst.filter(({ punt }) =>
                        vraagtActie(statusVanPunt(punt, stand(k.id).punten[punt.sleutel])),
                      ).length;
                      const staat = o === 0 ? "klaar" : o < lijst.length ? "bezig" : "open";
                      return <span key={b} className={`h-2 w-2 rounded-full ${PIP[staat]}`} />;
                    })}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* ---- dossier ---- */}
        <div className="min-w-0 space-y-4">
          <section className="rounded-lg border border-neutral-200 bg-white p-4">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="flex-1 text-lg font-semibold tracking-tight text-charcoal">{d.naam}</h2>
              <button
                onClick={() =>
                  stuur({ actie: "afgewerkt", klantId: d.id, aan: !s.afgewerkt }, (v) => ({
                    ...v,
                    afgewerkt: v.afgewerkt ? null : { door: ikBen, op: new Date().toISOString() },
                  }))
                }
                className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium transition ${
                  s.afgewerkt
                    ? "border-ok-text/30 bg-ok-bg text-ok-text"
                    : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
                }`}
              >
                <Check size={14} /> {s.afgewerkt ? "Afgewerkt" : "Markeer als afgewerkt"}
              </button>
            </div>
            <p className="tnum mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500">
              <span>Nomeo-id {d.nomeoId ?? "geen"}</span>
              <span>CoManage {d.comanageId ?? "niet aangemaakt"}</span>
              <span>{d.aantalDomeinen} domeinen</span>
              <span>{d.aantalSites} hosting-sites</span>
              <span className={telActie(d) > 0 ? "text-bad-text" : "text-ok-text"}>
                {telActie(d)} van {telAlles(d)} punten open
              </span>
              {s.afgewerkt && (
                <span>
                  afgewerkt door {kort(s.afgewerkt.door)} op {dt(s.afgewerkt.op)}
                </span>
              )}
            </p>
            {d.notities && (
              <p className="mt-3 whitespace-pre-wrap border-l-2 border-l-coral bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
                <span className="font-semibold text-charcoal">Notitie uit het CRM</span>
                {"\n"}
                {d.notities}
              </p>
            )}
          </section>

          {d.blokken.map((b) => {
            const lijst = puntenVan(d, b.id);
            const open = lijst.filter(({ punt }) =>
              vraagtActie(statusVanPunt(punt, s.punten[punt.sleutel])),
            ).length;
            return (
              <section key={b.id} className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
                <h3 className="flex items-center gap-2 border-b border-neutral-200 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                  {b.titel}
                  <span
                    className={`tnum ml-auto normal-case tracking-normal ${
                      open === 0 ? "text-ok-text" : "text-neutral-500"
                    }`}
                  >
                    {lijst.length === 0 ? "niets te controleren" : `${open} van ${lijst.length} open`}
                  </span>
                </h3>

                {lijst.length === 0 && (
                  <p className="px-4 py-3 text-xs text-neutral-400">
                    Niets te controleren voor deze klant.
                  </p>
                )}

                {lijst.map(({ punt, eigen }) => (
                  <RondePunt
                    key={punt.sleutel}
                    punt={punt}
                    puntStand={s.punten[punt.sleutel]}
                    eigen={eigen}
                    onAfhandelen={(reden) =>
                      stuur(
                        { actie: "afhandelen", klantId: d.id, sleutel: punt.sleutel, reden },
                        (v) =>
                          metPunt(v, punt.sleutel, ({ betwist: _w, ...rest }) => ({
                            ...rest,
                            afgehandeld: { reden, door: ikBen, op: new Date().toISOString() },
                          })),
                      )
                    }
                    onBetwisten={(reden) =>
                      stuur(
                        { actie: "betwisten", klantId: d.id, sleutel: punt.sleutel, reden },
                        (v) =>
                          metPunt(v, punt.sleutel, ({ afgehandeld: _w, ...rest }) => ({
                            ...rest,
                            betwist: { reden, door: ikBen, op: new Date().toISOString() },
                          })),
                      )
                    }
                    onHeropenen={() =>
                      stuur({ actie: "heropenen", klantId: d.id, sleutel: punt.sleutel }, (v) =>
                        metPunt(v, punt.sleutel, ({ afgehandeld: _a, betwist: _b, ...rest }) => rest),
                      )
                    }
                    onOpmerking={(tekst) =>
                      stuur(
                        { actie: "opmerking", klantId: d.id, sleutel: punt.sleutel, tekst },
                        (v) =>
                          metPunt(v, punt.sleutel, ({ opmerking: _o, ...rest }) =>
                            tekst.trim()
                              ? { ...rest, opmerking: { tekst, door: ikBen, op: new Date().toISOString() } }
                              : rest,
                          ),
                      )
                    }
                    onFactuur={() =>
                      stuur(
                        {
                          actie: "factuur",
                          klantId: d.id,
                          momentId: punt.momentId,
                          gefactureerd: punt.open,
                        },
                        (v) =>
                          metPunt(v, punt.sleutel, (p) => ({
                            ...p,
                            afgehandeld: {
                              reden: "gefactureerd",
                              door: ikBen,
                              op: new Date().toISOString(),
                            },
                          })),
                      )
                    }
                    onVerwijderen={() =>
                      stuur(
                        { actie: "eigen-verwijderen", klantId: d.id, id: punt.sleutel.slice(6) },
                        (v) => {
                          const punten = { ...v.punten };
                          delete punten[punt.sleutel];
                          return {
                            ...v,
                            punten,
                            eigen: v.eigen.filter((e) => eigenSleutel(e.id) !== punt.sleutel),
                          };
                        },
                      )
                    }
                  />
                ))}

                {nieuwIn === b.id ? (
                  <div className="flex flex-wrap gap-2 border-t border-neutral-100 px-4 py-2.5">
                    <input
                      autoFocus
                      value={nieuwTitel}
                      onChange={(e) => setNieuwTitel(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && voegEigenToe(b.id)}
                      placeholder="Wat moet hier nog gebeuren?"
                      className="min-w-0 flex-1 rounded-md border border-neutral-200 px-2 py-1 text-xs outline-none focus:border-neutral-300 focus:ring-2 focus:ring-coral/15"
                    />
                    <button
                      disabled={!nieuwTitel.trim()}
                      onClick={() => voegEigenToe(b.id)}
                      className="rounded-md bg-charcoal px-2.5 py-1 text-xs font-medium text-white transition hover:bg-charcoal-light disabled:opacity-40"
                    >
                      Toevoegen
                    </button>
                    <button
                      onClick={() => {
                        setNieuwIn(null);
                        setNieuwTitel("");
                      }}
                      className="rounded-md border border-neutral-200 px-2.5 py-1 text-xs text-neutral-600 transition hover:bg-neutral-50"
                    >
                      Annuleren
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setNieuwIn(b.id);
                      setNieuwTitel("");
                    }}
                    className="inline-flex w-full items-center gap-1.5 border-t border-neutral-100 px-4 py-2 text-left text-xs text-neutral-500 transition hover:bg-neutral-50"
                  >
                    <Plus size={12} /> Eigen punt toevoegen
                  </button>
                )}
              </section>
            );
          })}

          <section className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
            <h3 className="border-b border-neutral-200 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              Bevindingen over deze klant
            </h3>
            <textarea
              key={d.id}
              defaultValue={s.bevindingen}
              onChange={(e) => {
                const tekst = e.target.value;
                const klantId = d.id;
                if (notTimer.current) clearTimeout(notTimer.current);
                notTimer.current = setTimeout(
                  () =>
                    stuur({ actie: "bevindingen", klantId, tekst }, (v) => ({
                      ...v,
                      bevindingen: tekst,
                    })),
                  600,
                );
              }}
              placeholder="Wat je tegenkwam bij deze klant: gebeld, wacht op antwoord, factuur verstuurd op …"
              className="min-h-24 w-full resize-y px-4 py-3 text-sm outline-none placeholder:text-neutral-400"
            />
          </section>

          <div className="flex justify-between gap-2 pb-8">
            <button
              disabled={idx <= 0}
              onClick={() => setHuidig(dossiers[idx - 1].id)}
              className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-600 transition hover:bg-neutral-50 disabled:opacity-40"
            >
              <ChevronLeft size={15} /> Vorige
            </button>
            <button
              disabled={idx >= dossiers.length - 1}
              onClick={() => setHuidig(dossiers[idx + 1].id)}
              className="inline-flex items-center gap-1 rounded-md bg-charcoal px-3 py-2 text-sm font-medium text-white transition hover:bg-charcoal-light disabled:opacity-40"
            >
              Volgende klant <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
