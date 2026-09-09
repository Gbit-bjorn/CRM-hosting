"use client";
import { useState } from "react";
import { MessageSquarePlus, Trash2, Undo2 } from "lucide-react";
import type { Punt, PuntStand, Toon } from "@/lib/ronde";

export type PuntStatus = "open" | "betwist" | "opgelost" | "afgehandeld";

export function statusVanPunt(p: Punt, ps: PuntStand | undefined): PuntStatus {
  if (ps?.afgehandeld) return "afgehandeld";
  if (ps?.betwist) return "betwist";
  return p.open ? "open" : "opgelost";
}

/** Betwiste punten vragen net zo goed om actie als open punten. */
export const vraagtActie = (st: PuntStatus) => st === "open" || st === "betwist";

const RAND: Record<PuntStatus, string> = {
  open: "border-l-bad-text",
  betwist: "border-l-warn-text",
  opgelost: "border-l-ok-text",
  afgehandeld: "border-l-neutral-300",
};
const STIP: Record<PuntStatus, string> = {
  open: "bg-bad-text",
  betwist: "bg-warn-text",
  opgelost: "bg-ok-text",
  afgehandeld: "bg-neutral-300",
};
const RAND_ZACHT: Record<Toon, string> = {
  bad: "border-l-bad-text",
  warn: "border-l-warn-text",
  info: "border-l-neutral-400",
};
const STIP_ZACHT: Record<Toon, string> = {
  bad: "bg-bad-text",
  warn: "bg-warn-text",
  info: "bg-neutral-400",
};

const dt = (iso: string) =>
  new Date(iso).toLocaleString("nl-BE", { dateStyle: "short", timeStyle: "short" });
const kort = (m: string) => m.split("@")[0];

const knop =
  "rounded border border-neutral-200 px-2 py-0.5 text-[11px] text-neutral-600 transition hover:bg-neutral-50";

export default function RondePunt({
  punt,
  puntStand,
  eigen,
  onAfhandelen,
  onBetwisten,
  onHeropenen,
  onOpmerking,
  onFactuur,
  onVerwijderen,
}: {
  punt: Punt;
  puntStand: PuntStand | undefined;
  eigen: boolean;
  onAfhandelen: (reden: string) => void;
  onBetwisten: (reden: string) => void;
  onHeropenen: () => void;
  onOpmerking: (tekst: string) => void;
  onFactuur: () => void;
  onVerwijderen: () => void;
}) {
  const st = statusVanPunt(punt, puntStand);
  const [vraag, setVraag] = useState<null | "afhandelen" | "betwisten">(null);
  const [reden, setReden] = useState("");
  const [opmerkt, setOpmerkt] = useState(false);
  const [tekst, setTekst] = useState(puntStand?.opmerking?.tekst ?? "");

  const rand = st === "open" ? RAND_ZACHT[punt.toon] : RAND[st];
  const stip = st === "open" ? STIP_ZACHT[punt.toon] : STIP[st];
  const merk = puntStand?.afgehandeld ?? puntStand?.betwist;

  function bevestig() {
    const r = reden.trim();
    if (!r) return;
    if (vraag === "afhandelen") onAfhandelen(r);
    else onBetwisten(r);
    setVraag(null);
    setReden("");
  }

  return (
    <div className={`border-b border-l-2 border-neutral-100 px-4 py-2.5 last:border-b-0 ${rand}`}>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className={`h-2 w-2 flex-none rounded-full ${stip}`} />
        <span
          className={`text-sm font-medium ${
            st === "afgehandeld" ? "text-neutral-400 line-through" : "text-charcoal"
          }`}
        >
          {punt.titel}
        </span>
        {punt.bijschrift && <span className="tnum text-xs text-neutral-500">{punt.bijschrift}</span>}
        {st === "betwist" && (
          <span className="rounded bg-warn-bg px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warn-text">
            klopt niet
          </span>
        )}

        <span className="ml-auto flex flex-none flex-wrap items-center gap-1.5">
          {punt.momentId && st !== "afgehandeld" && (
            <button onClick={onFactuur} className={knop}>
              markeer gefactureerd
            </button>
          )}
          {!opmerkt && (
            <button
              onClick={() => setOpmerkt(true)}
              className={`${knop} inline-flex items-center gap-1`}
              title="Opmerking bij deze lijn"
            >
              <MessageSquarePlus size={11} />
              {puntStand?.opmerking ? "opmerking aanpassen" : "opmerking"}
            </button>
          )}
          {vraag === null && vraagtActie(st) && (
            <button
              onClick={() => {
                setVraag("afhandelen");
                setReden("");
              }}
              className={knop}
            >
              afhandelen
            </button>
          )}
          {vraag === null && st === "opgelost" && (
            <button
              onClick={() => {
                setVraag("betwisten");
                setReden("");
              }}
              className={knop}
            >
              klopt niet
            </button>
          )}
          {(st === "afgehandeld" || st === "betwist") && (
            <button onClick={onHeropenen} className={`${knop} inline-flex items-center gap-1`}>
              <Undo2 size={11} /> heropenen
            </button>
          )}
          {eigen && (
            <button
              onClick={onVerwijderen}
              className={`${knop} inline-flex items-center gap-1`}
              title="Eigen punt verwijderen"
            >
              <Trash2 size={11} /> verwijderen
            </button>
          )}
        </span>
      </div>

      {punt.uitleg.length > 0 && (
        <ul className="mt-1 space-y-0.5 pl-4 text-xs text-neutral-500">
          {punt.uitleg.map((u, i) => (
            <li key={i}>{u}</li>
          ))}
        </ul>
      )}

      {merk && (
        <p className="mt-1 pl-4 text-[11px] text-neutral-400">
          {puntStand?.afgehandeld ? "Afgehandeld" : "Gemeld als fout"}: {merk.reden} — {kort(merk.door)}, {dt(merk.op)}
        </p>
      )}

      {puntStand?.opmerking && !opmerkt && (
        <p className="mt-1.5 ml-4 whitespace-pre-wrap border-l-2 border-l-coral bg-neutral-50 px-3 py-1.5 text-xs text-neutral-600">
          {puntStand.opmerking.tekst}
          <span className="mt-0.5 block text-[11px] text-neutral-400">
            {kort(puntStand.opmerking.door)}, {dt(puntStand.opmerking.op)}
          </span>
        </p>
      )}

      {opmerkt && (
        <div className="mt-2 pl-4">
          <textarea
            autoFocus
            value={tekst}
            onChange={(e) => setTekst(e.target.value)}
            placeholder="Opmerking bij deze lijn, bv. klant wil dit domein niet meer verlengen"
            className="min-h-16 w-full resize-y rounded-md border border-neutral-200 px-2 py-1.5 text-xs outline-none focus:border-neutral-300 focus:ring-2 focus:ring-coral/15"
          />
          <div className="mt-1.5 flex flex-wrap gap-2">
            <button
              onClick={() => {
                onOpmerking(tekst);
                setOpmerkt(false);
              }}
              className="rounded-md bg-charcoal px-2.5 py-1 text-xs font-medium text-white transition hover:bg-charcoal-light"
            >
              Bewaren
            </button>
            <button
              onClick={() => {
                setTekst(puntStand?.opmerking?.tekst ?? "");
                setOpmerkt(false);
              }}
              className="rounded-md border border-neutral-200 px-2.5 py-1 text-xs text-neutral-600 transition hover:bg-neutral-50"
            >
              Annuleren
            </button>
            {puntStand?.opmerking && (
              <button
                onClick={() => {
                  setTekst("");
                  onOpmerking("");
                  setOpmerkt(false);
                }}
                className="rounded-md border border-neutral-200 px-2.5 py-1 text-xs text-neutral-500 transition hover:bg-neutral-50"
              >
                Wissen
              </button>
            )}
          </div>
        </div>
      )}

      {vraag && (
        <div className="mt-2 flex flex-wrap gap-2 pl-4">
          <input
            autoFocus
            value={reden}
            onChange={(e) => setReden(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && bevestig()}
            placeholder={
              vraag === "afhandelen"
                ? "Waarom is dit afgehandeld? bv. particulier, geen btw-plicht"
                : "Wat klopt er niet? bv. btw-nummer is van de vorige zaakvoerder"
            }
            className="min-w-0 flex-1 rounded-md border border-neutral-200 px-2 py-1 text-xs outline-none focus:border-neutral-300 focus:ring-2 focus:ring-coral/15"
          />
          <button
            disabled={!reden.trim()}
            onClick={bevestig}
            className="rounded-md bg-charcoal px-2.5 py-1 text-xs font-medium text-white transition hover:bg-charcoal-light disabled:opacity-40"
          >
            Bewaren
          </button>
          <button
            onClick={() => setVraag(null)}
            className="rounded-md border border-neutral-200 px-2.5 py-1 text-xs text-neutral-600 transition hover:bg-neutral-50"
          >
            Annuleren
          </button>
        </div>
      )}
    </div>
  );
}
