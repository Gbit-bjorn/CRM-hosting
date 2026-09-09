"use client";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, RotateCw, Undo2 } from "lucide-react";
import type { Dossier, Punt, Stand, Toon } from "@/lib/ronde";
import { PageHeader } from "@/components/ui/PageHeader";
import { SearchInput } from "@/components/ui/SearchInput";

type Status = "open" | "opgelost" | "afgehandeld";

const RAND: Record<Status, string> = {
  open: "border-l-2 border-l-bad-text",
  opgelost: "border-l-2 border-l-ok-text",
  afgehandeld: "border-l-2 border-l-neutral-300",
};
const RAND_WARN = "border-l-2 border-l-warn-text";
const RAND_INFO = "border-l-2 border-l-neutral-400";

const STIP: Record<Status, string> = {
  open: "bg-bad-text",
  opgelost: "bg-ok-text",
  afgehandeld: "bg-neutral-300",
};
const STIP_WARN = "bg-warn-text";
const STIP_INFO = "bg-neutral-400";

const PIP: Record<"open" | "bezig" | "klaar", string> = {
  open: "bg-neutral-200",
  bezig: "bg-warn-text",
  klaar: "bg-ok-text",
};

const dt = (iso: string) =>
  new Date(iso).toLocaleString("nl-BE", { dateStyle: "short", timeStyle: "short" });
const kortMail = (m: string) => m.split("@")[0];

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
  const [redenVoor, setRedenVoor] = useState<string | null>(null);
  const [reden, setReden] = useState("");
  const [vernieuwt, setVernieuwt] = useState(false);
  const notTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stand = (id: string): Stand =>
    standen[id] ?? { afgehandeld: {}, bevindingen: "", afgewerkt: null };

  async function stuur(body: Record<string, unknown>, lokaal: (s: Stand) => Stand) {
    const klantId = body.klantId as string;
    setStanden((v) => ({ ...v, [klantId]: lokaal(stand(klantId)) }));
    const res = await fetch("/api/ronde", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) router.refresh();
  }

  function statusVan(d: Dossier, p: Punt): Status {
    if (stand(d.id).afgehandeld[p.sleutel]) return "afgehandeld";
    return p.open ? "open" : "opgelost";
  }
  const telOpen = (d: Dossier) =>
    d.blokken.reduce((t, b) => t + b.punten.filter((p) => statusVan(d, p) === "open").length, 0);
  const telAlles = (d: Dossier) => d.blokken.reduce((t, b) => t + b.punten.length, 0);

  const zichtbaar = useMemo(() => {
    const q = zoek.trim().toLowerCase();
    return dossiers.filter((d) => {
      if (q) {
        const hooi = (
          d.naam +
          " " +
          d.blokken.flatMap((b) => b.punten.map((p) => p.titel)).join(" ")
        ).toLowerCase();
        if (!hooi.includes(q)) return false;
      }
      const af = !!stand(d.id).afgewerkt;
      if (filter === "klaar") return af;
      if (filter === "tedoen") return !af && telOpen(d) > 0;
      if (filter === "bezig") return !af && telOpen(d) === 0;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dossiers, standen, filter, zoek]);

  const d = dossiers.find((x) => x.id === huidig) ?? dossiers[0];
  const idx = dossiers.findIndex((x) => x.id === d?.id);
  const klaarTotaal = dossiers.filter((x) => stand(x.id).afgewerkt).length;

  if (!d) return <p className="text-sm text-neutral-500">Geen klanten gevonden.</p>;
  const s = stand(d.id);

  function rand(st: Status, toon: Toon) {
    if (st !== "open") return RAND[st];
    return toon === "bad" ? RAND.open : toon === "warn" ? RAND_WARN : RAND_INFO;
  }
  function stip(st: Status, toon: Toon) {
    if (st !== "open") return STIP[st];
    return toon === "bad" ? STIP.open : toon === "warn" ? STIP_WARN : STIP_INFO;
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Facturatieronde" count={dossiers.length}>
        <span className="tnum text-sm text-neutral-500">
          {klaarTotaal} van {dossiers.length} klanten afgewerkt
        </span>
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
        <aside className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] flex flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white">
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
              const open = telOpen(k);
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
                    {k.blokken.map((b) => {
                      const o = b.punten.filter((p) => statusVan(k, p) === "open").length;
                      const staat = b.punten.length === 0 ? "klaar" : o === 0 ? "klaar" : o < b.punten.length ? "bezig" : "open";
                      return (
                        <span key={b.id} className={`h-2 w-2 rounded-full ${PIP[staat]}`} title={b.titel} />
                      );
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
              <span className={telOpen(d) > 0 ? "text-bad-text" : "text-ok-text"}>
                {telOpen(d)} van {telAlles(d)} punten open
              </span>
              {s.afgewerkt && (
                <span>
                  afgewerkt door {kortMail(s.afgewerkt.door)} op {dt(s.afgewerkt.op)}
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
            const open = b.punten.filter((p) => statusVan(d, p) === "open").length;
            return (
              <section key={b.id} className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
                <h3 className="flex items-center gap-2 border-b border-neutral-200 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                  {b.titel}
                  <span className={`tnum ml-auto normal-case tracking-normal ${open === 0 ? "text-ok-text" : "text-neutral-500"}`}>
                    {b.punten.length === 0 ? "niets te controleren" : `${open} van ${b.punten.length} open`}
                  </span>
                </h3>

                {b.punten.length === 0 && (
                  <p className="px-4 py-3 text-xs text-neutral-400">Niets te controleren voor deze klant.</p>
                )}

                {b.punten.map((p) => {
                  const st = statusVan(d, p);
                  const afg = s.afgehandeld[p.sleutel];
                  return (
                    <div
                      key={p.sleutel}
                      className={`border-b border-neutral-100 px-4 py-2.5 last:border-b-0 ${rand(st, p.toon)}`}
                    >
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <span className={`h-2 w-2 flex-none translate-y-[-1px] rounded-full ${stip(st, p.toon)}`} />
                        <span
                          className={`text-sm font-medium ${
                            st === "afgehandeld" ? "text-neutral-400 line-through" : "text-charcoal"
                          }`}
                        >
                          {p.titel}
                        </span>
                        {p.bijschrift && (
                          <span className="tnum text-xs text-neutral-500">{p.bijschrift}</span>
                        )}
                        <span className="ml-auto flex flex-none items-center gap-2">
                          {p.momentId && st !== "afgehandeld" && (
                            <button
                              onClick={() =>
                                stuur(
                                  {
                                    actie: "factuur",
                                    klantId: d.id,
                                    momentId: p.momentId,
                                    gefactureerd: p.open,
                                  },
                                  (v) => ({
                                    ...v,
                                    afgehandeld: {
                                      ...v.afgehandeld,
                                      [p.sleutel]: {
                                        reden: "gefactureerd",
                                        door: ikBen,
                                        op: new Date().toISOString(),
                                      },
                                    },
                                  }),
                                )
                              }
                              className="rounded border border-neutral-200 px-2 py-0.5 text-[11px] text-neutral-600 transition hover:bg-neutral-50"
                            >
                              markeer gefactureerd
                            </button>
                          )}
                          {st === "open" && redenVoor !== p.sleutel && (
                            <button
                              onClick={() => {
                                setRedenVoor(p.sleutel);
                                setReden("");
                              }}
                              className="rounded border border-neutral-200 px-2 py-0.5 text-[11px] text-neutral-600 transition hover:bg-neutral-50"
                            >
                              afhandelen
                            </button>
                          )}
                          {st === "afgehandeld" && (
                            <button
                              onClick={() =>
                                stuur({ actie: "heropenen", klantId: d.id, sleutel: p.sleutel }, (v) => {
                                  const rest = { ...v.afgehandeld };
                                  delete rest[p.sleutel];
                                  return { ...v, afgehandeld: rest };
                                })
                              }
                              className="inline-flex items-center gap-1 rounded border border-neutral-200 px-2 py-0.5 text-[11px] text-neutral-500 transition hover:bg-neutral-50"
                            >
                              <Undo2 size={11} /> heropenen
                            </button>
                          )}
                        </span>
                      </div>

                      <ul className="mt-1 space-y-0.5 pl-4 text-xs text-neutral-500">
                        {p.uitleg.map((u, i) => (
                          <li key={i}>{u}</li>
                        ))}
                      </ul>

                      {afg && (
                        <p className="mt-1 pl-4 text-[11px] text-neutral-400">
                          Afgehandeld: {afg.reden} — {kortMail(afg.door)}, {dt(afg.op)}
                        </p>
                      )}

                      {redenVoor === p.sleutel && (
                        <div className="mt-2 flex flex-wrap gap-2 pl-4">
                          <input
                            autoFocus
                            value={reden}
                            onChange={(e) => setReden(e.target.value)}
                            placeholder="Waarom is dit afgehandeld? bv. particulier, geen btw-plicht"
                            className="min-w-0 flex-1 rounded-md border border-neutral-200 px-2 py-1 text-xs outline-none focus:border-neutral-300 focus:ring-2 focus:ring-coral/15"
                          />
                          <button
                            disabled={!reden.trim()}
                            onClick={() => {
                              const r = reden.trim();
                              stuur(
                                { actie: "afhandelen", klantId: d.id, sleutel: p.sleutel, reden: r },
                                (v) => ({
                                  ...v,
                                  afgehandeld: {
                                    ...v.afgehandeld,
                                    [p.sleutel]: { reden: r, door: ikBen, op: new Date().toISOString() },
                                  },
                                }),
                              );
                              setRedenVoor(null);
                            }}
                            className="rounded-md bg-charcoal px-2.5 py-1 text-xs font-medium text-white transition hover:bg-charcoal-light disabled:opacity-40"
                          >
                            Bewaren
                          </button>
                          <button
                            onClick={() => setRedenVoor(null)}
                            className="rounded-md border border-neutral-200 px-2.5 py-1 text-xs text-neutral-600 transition hover:bg-neutral-50"
                          >
                            Annuleren
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </section>
            );
          })}

          <section className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
            <h3 className="border-b border-neutral-200 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              Bevindingen
            </h3>
            <textarea
              key={d.id}
              defaultValue={s.bevindingen}
              onChange={(e) => {
                const tekst = e.target.value;
                const klantId = d.id;
                if (notTimer.current) clearTimeout(notTimer.current);
                notTimer.current = setTimeout(
                  () => stuur({ actie: "bevindingen", klantId, tekst }, (v) => ({ ...v, bevindingen: tekst })),
                  600,
                );
              }}
              placeholder="Wat je tegenkwam bij deze klant: gebeld, wacht op antwoord, Nomeo klopt niet, factuur verstuurd op …"
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
