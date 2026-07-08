"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import { LayoutGrid, List } from "lucide-react";
import { SearchInput } from "@/components/ui/SearchInput";
import { Badge } from "@/components/ui/Badge";
import { tbl } from "@/components/ui/table";

export type Kaart = {
  id: string;
  naam: string;
  type: string;
  sites: number;
  domeinen: number;
  jaartotaal: number;
  profiel: "hosting" | "domein-only" | "leeg";
  contact: string | null;
};

const filters = [
  { key: "alle", label: "Alle" },
  { key: "hosting", label: "Hosting" },
  { key: "domein", label: "Domein-only" },
  { key: "reseller", label: "Resellers" },
];
const sorts = [
  { key: "naam", label: "Naam (A–Z)" },
  { key: "bedrag", label: "Jaarbedrag (hoog–laag)" },
  { key: "domeinen", label: "Domeinen (veel–weinig)" },
];

function Tags({ k }: { k: Kaart }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {k.type === "reseller" && <Badge soort="reseller">Reseller</Badge>}
      {k.profiel === "hosting" && <Badge soort="hosting">Hosting</Badge>}
      {k.profiel === "domein-only" && <Badge soort="domein">Domein-only</Badge>}
    </div>
  );
}

export default function KlantenView({ klanten }: { klanten: Kaart[] }) {
  const [zoek, setZoek] = useState("");
  const [filter, setFilter] = useState("alle");
  const [sort, setSort] = useState("naam");
  const [view, setView] = useState<"tabel" | "kaart">("tabel");

  const rijen = useMemo(() => {
    const gefilterd = klanten.filter((k) => {
      if (zoek && !k.naam.toLowerCase().includes(zoek.toLowerCase())) return false;
      if (filter === "hosting") return k.profiel === "hosting";
      if (filter === "domein") return k.profiel === "domein-only";
      if (filter === "reseller") return k.type === "reseller";
      return true;
    });
    return [...gefilterd].sort((a, b) =>
      sort === "naam"
        ? a.naam.localeCompare(b.naam)
        : sort === "bedrag"
          ? b.jaartotaal - a.jaartotaal
          : b.domeinen - a.domeinen,
    );
  }, [klanten, zoek, filter, sort]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={zoek} onChange={setZoek} placeholder="Zoek klant…" />
        <div className="flex gap-1">
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
              onClick={() => setView("tabel")}
              aria-label="Lijstweergave"
              className={`p-1.5 ${view === "tabel" ? "bg-neutral-100 text-charcoal" : "bg-white text-neutral-500 hover:bg-neutral-50"}`}
            >
              <List size={16} />
            </button>
            <button
              onClick={() => setView("kaart")}
              aria-label="Kaartweergave"
              className={`border-l border-neutral-200 p-1.5 ${view === "kaart" ? "bg-neutral-100 text-charcoal" : "bg-white text-neutral-500 hover:bg-neutral-50"}`}
            >
              <LayoutGrid size={16} />
            </button>
          </div>
        </div>
      </div>

      {view === "tabel" ? (
        <div className={tbl.wrap}>
          <div className={tbl.scroll}>
            <table className={tbl.table}>
              <thead>
                <tr>
                  <th className={tbl.th}>Klant</th>
                  <th className={tbl.th}>Type</th>
                  <th className={tbl.th}>Contact</th>
                  <th className={tbl.thNum}>Domeinen</th>
                  <th className={tbl.thNum}>Sites</th>
                  <th className={tbl.thNum}>Per jaar</th>
                </tr>
              </thead>
              <tbody>
                {rijen.map((k) => (
                  <tr key={k.id} className={tbl.tr}>
                    <td className={tbl.tdName}>
                      <Link href={`/klanten/${k.id}`} className={tbl.rowLink}>
                        {k.naam}
                      </Link>
                    </td>
                    <td className={tbl.td}>
                      <Tags k={k} />
                    </td>
                    <td className={tbl.td}>{k.contact ?? "—"}</td>
                    <td className={tbl.tdNum}>{k.domeinen}</td>
                    <td className={tbl.tdNum}>{k.sites}</td>
                    <td className={tbl.tdNum}>€{k.jaartotaal.toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rijen.map((k) => (
            <Link
              key={k.id}
              href={`/klanten/${k.id}`}
              className="block rounded-lg border border-neutral-200 bg-white p-4 transition hover:border-coral/40"
            >
              <h3 className="mb-2 font-medium leading-tight text-neutral-800">{k.naam}</h3>
              <div className="mb-3">
                <Tags k={k} />
              </div>
              <dl className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <dt className="text-xs text-neutral-400">Domeinen</dt>
                  <dd className="tnum font-medium text-neutral-700">{k.domeinen}</dd>
                </div>
                <div>
                  <dt className="text-xs text-neutral-400">Sites</dt>
                  <dd className="tnum font-medium text-neutral-700">{k.sites}</dd>
                </div>
                <div>
                  <dt className="text-xs text-neutral-400">Per jaar</dt>
                  <dd className="tnum font-medium text-neutral-700">€{k.jaartotaal.toFixed(0)}</dd>
                </div>
              </dl>
            </Link>
          ))}
        </div>
      )}

      <p className="text-xs text-neutral-400">
        {rijen.length} van {klanten.length} klanten · bedragen excl. btw
      </p>
    </div>
  );
}
