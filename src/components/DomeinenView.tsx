"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import { List, Users } from "lucide-react";
import { SearchInput } from "@/components/ui/SearchInput";
import { Badge } from "@/components/ui/Badge";
import { StatusDot, type Tone } from "@/components/ui/StatusDot";
import { tbl } from "@/components/ui/table";
import VerplaatsKnop, { type KlantOptie } from "@/components/VerplaatsKnop";

export type DomeinRij = {
  id: string;
  naam: string;
  klant: string;
  klantId: string | null;
  expireDate: string | null;
  autoRenew: boolean;
  heeftHosting: boolean;
  inNomeo: boolean;
  registratieStatus: string | null; // whois: AVAILABLE = vervallen én weer vrij
  registrar: string | null; // whois: waar het geregistreerd is (enkel buiten ons Nomeo)
};

const filters = [
  { key: "alle", label: "Alle" },
  { key: "nomeo", label: "In ons Nomeo" },
  { key: "buiten", label: "Buiten ons beheer" },
  { key: "vervallen", label: "Vervallen" },
  { key: "geen-renew", label: "Auto-renew uit" },
  { key: "binnenkort", label: "Vervalt < 30d" },
];
const sorts = [
  { key: "vervalt", label: "Vervaldatum (eerst)" },
  { key: "naam", label: "Domein (A–Z)" },
];

function statusVan(d: DomeinRij): { tone: Tone; label: string } {
  // Whois (live-check) heeft het laatste woord: AVAILABLE = registratie echt weg.
  if (d.registratieStatus === "AVAILABLE") return { tone: "bad", label: "vervallen — weer vrij" };
  // Buiten ons Nomeo-account weten we alleen dat het geregistreerd is (whois);
  // de vervaldatum en auto-renew-vlag komen uit de oude Plesk-export en zeggen niets.
  if (!d.inNomeo) {
    const reg = d.registrar?.split(" - ")[0]?.trim();
    return { tone: "idle", label: reg ? `buiten ons beheer · bij ${reg}` : "buiten ons beheer" };
  }
  const dagen = d.expireDate
    ? (new Date(d.expireDate).getTime() - Date.now()) / 86_400_000
    : null;
  if (!d.autoRenew)
    return dagen != null && dagen < 30
      ? { tone: "bad", label: "auto-renew UIT — vervalt echt" }
      : { tone: "warn", label: "auto-renew uit" };
  if (dagen != null && dagen < 30) return { tone: "ok", label: "verlengt automatisch" };
  return { tone: "ok", label: "actief" };
}

/** Datumlabel: enkel Nomeo-datums zijn betrouwbaar; de rest is oude Plesk-data. */
function vervaltLabel(d: DomeinRij): string | null {
  if (!d.expireDate) return null;
  const datum = d.expireDate.slice(0, 10);
  return d.inNomeo ? `vervalt ${datum}` : `oude Plesk-datum ${datum}`;
}

export default function DomeinenView({
  domeinen,
  klanten,
}: {
  domeinen: DomeinRij[];
  klanten: KlantOptie[];
}) {
  const [zoek, setZoek] = useState("");
  const [filter, setFilter] = useState("alle");
  const [sort, setSort] = useState("vervalt");
  const [view, setView] = useState<"lijst" | "klant">("lijst");

  const rijen = useMemo(() => {
    const q = zoek.toLowerCase();
    const gefilterd = domeinen.filter((d) => {
      if (q && !d.naam.toLowerCase().includes(q) && !d.klant.toLowerCase().includes(q))
        return false;
      if (filter === "nomeo") return d.inNomeo;
      if (filter === "buiten") return !d.inNomeo && d.registratieStatus !== "AVAILABLE";
      if (filter === "vervallen") return d.registratieStatus === "AVAILABLE";
      // Auto-renew en vervaldatum zijn enkel betrouwbaar voor ons eigen Nomeo-portfolio.
      if (filter === "geen-renew") return d.inNomeo && !d.autoRenew;
      if (filter === "binnenkort") {
        if (!d.inNomeo || !d.expireDate) return false;
        return (new Date(d.expireDate).getTime() - Date.now()) / 86_400_000 < 30;
      }
      return true;
    });
    return [...gefilterd].sort((a, b) => {
      if (sort === "naam") return a.naam.localeCompare(b.naam);
      const ta = a.expireDate ? new Date(a.expireDate).getTime() : Infinity;
      const tb = b.expireDate ? new Date(b.expireDate).getTime() : Infinity;
      return ta - tb;
    });
  }, [domeinen, zoek, filter, sort]);

  const perKlant = useMemo(() => {
    const groepen = new Map<string, DomeinRij[]>();
    for (const d of rijen) {
      const lijst = groepen.get(d.klant) ?? [];
      lijst.push(d);
      groepen.set(d.klant, lijst);
    }
    return [...groepen.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([klant, ds]) => ({
        klant,
        klantId: ds[0].klantId,
        domeinen: [...ds].sort((a, b) => a.naam.localeCompare(b.naam)),
      }));
  }, [rijen]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={zoek} onChange={setZoek} placeholder="Zoek domein of klant…" />
        <div className="flex flex-wrap gap-1">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-md border px-2.5 py-1.5 text-sm transition ${
                filter === f.key
                  ? "border-coral/30 bg-coral-tint text-coral-hover"
                  : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-sm text-neutral-700 outline-none focus:border-neutral-300"
          >
            {sorts.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
          <div className="flex overflow-hidden rounded-md border border-neutral-200">
            <button
              onClick={() => setView("lijst")}
              aria-label="Lijstweergave"
              title="Lijst"
              className={`p-1.5 ${view === "lijst" ? "bg-neutral-100 text-charcoal" : "bg-white text-neutral-500 hover:bg-neutral-50"}`}
            >
              <List size={16} />
            </button>
            <button
              onClick={() => setView("klant")}
              aria-label="Gegroepeerd per klant"
              title="Per klant"
              className={`border-l border-neutral-200 p-1.5 ${view === "klant" ? "bg-neutral-100 text-charcoal" : "bg-white text-neutral-500 hover:bg-neutral-50"}`}
            >
              <Users size={16} />
            </button>
          </div>
        </div>
      </div>

      {view === "klant" ? (
        <div className="space-y-3">
          {perKlant.map((g) => (
            <section key={g.klant} className="rounded-lg border border-neutral-200 bg-white">
              <div className="flex items-center justify-between gap-3 border-b border-neutral-100 px-3 py-2">
                {g.klantId ? (
                  <Link
                    href={`/klanten/${g.klantId}`}
                    className="text-sm font-semibold text-neutral-800 hover:text-coral-hover hover:underline"
                  >
                    {g.klant}
                  </Link>
                ) : (
                  <span className="text-sm font-semibold text-neutral-800">{g.klant}</span>
                )}
                <span className="tnum text-xs text-neutral-400">
                  {g.domeinen.length} domein{g.domeinen.length === 1 ? "" : "en"}
                </span>
              </div>
              <ul className="divide-y divide-neutral-100">
                {g.domeinen.map((d) => {
                  const s = statusVan(d);
                  return (
                    <li key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                      <Link
                        href={`/domeinen/${d.id}`}
                        className="text-sm font-medium text-neutral-800 hover:text-coral-hover hover:underline"
                      >
                        {d.naam}
                      </Link>
                      <Badge soort={d.heeftHosting ? "hosting" : "domein"}>
                        {d.heeftHosting ? "Hosting" : "Domein"}
                      </Badge>
                      <StatusDot tone={s.tone}>{s.label}</StatusDot>
                      {vervaltLabel(d) && (
                        <span className="tnum text-xs text-neutral-500">{vervaltLabel(d)}</span>
                      )}
                      <span className="ml-auto">
                        <VerplaatsKnop type="domein" id={d.id} naam={d.naam} huidigeKlantId={d.klantId} klanten={klanten} />
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          {perKlant.length === 0 && (
            <p className="rounded-lg border border-neutral-200 bg-white p-4 text-center text-sm text-neutral-400">
              Geen domeinen gevonden.
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-2 md:hidden">
            {rijen.map((d) => {
              const s = statusVan(d);
              return (
                <div key={d.id} className="rounded-lg border border-neutral-200 bg-white p-3">
                  <div className="flex items-center justify-between gap-3">
                    <Link
                      href={`/domeinen/${d.id}`}
                      className="text-sm font-medium text-neutral-800 hover:text-coral-hover"
                    >
                      {d.naam}
                    </Link>
                    <Badge soort={d.heeftHosting ? "hosting" : "domein"}>
                      {d.heeftHosting ? "Hosting" : "Domein"}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-neutral-500">{d.klant}</p>
                  <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
                    <StatusDot tone={s.tone}>{s.label}</StatusDot>
                    <span className="inline-flex items-center gap-2">
                      {vervaltLabel(d) && (
                        <span className="tnum text-xs text-neutral-500">{vervaltLabel(d)}</span>
                      )}
                      <VerplaatsKnop type="domein" id={d.id} naam={d.naam} huidigeKlantId={d.klantId} klanten={klanten} />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className={`${tbl.wrap} hidden md:block`}>
            <div className={tbl.scroll}>
              <table className={tbl.table}>
                <thead>
                  <tr>
                    <th className={tbl.th}>Domein</th>
                    <th className={tbl.th}>Klant</th>
                    <th className={tbl.th}>Type</th>
                    <th className={tbl.thNum}>Vervalt</th>
                    <th className={tbl.th}>Status</th>
                    <th className={tbl.thNum}></th>
                  </tr>
                </thead>
                <tbody>
                  {rijen.map((d) => {
                    const s = statusVan(d);
                    return (
                      <tr key={d.id} className={tbl.tr}>
                        <td className={tbl.tdName}>
                          <Link href={`/domeinen/${d.id}`} className={tbl.rowLink}>
                            {d.naam}
                          </Link>
                        </td>
                        <td className={tbl.td}>{d.klant}</td>
                        <td className={tbl.td}>
                          <Badge soort={d.heeftHosting ? "hosting" : "domein"}>
                            {d.heeftHosting ? "Hosting" : "Domein"}
                          </Badge>
                        </td>
                        <td className={tbl.tdNum}>
                          {d.expireDate ? d.expireDate.slice(0, 10) : "—"}
                          {d.expireDate && !d.inNomeo && (
                            <span className="block text-[11px] text-neutral-400">oude Plesk-datum</span>
                          )}
                        </td>
                        <td className={tbl.td}>
                          <StatusDot tone={s.tone}>{s.label}</StatusDot>
                        </td>
                        <td className={`${tbl.tdNum} relative z-10`}>
                          <VerplaatsKnop type="domein" id={d.id} naam={d.naam} huidigeKlantId={d.klantId} klanten={klanten} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
      <p className="text-xs text-neutral-400">
        {rijen.length} van {domeinen.length} domeinen · verplaatsen neemt abonnement en hosting-site mee
      </p>
    </div>
  );
}
