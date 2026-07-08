"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import { SearchInput } from "@/components/ui/SearchInput";
import { tbl } from "@/components/ui/table";

export type SiteRij = {
  id: string;
  naam: string;
  factuurKlant: string;
  eindKlant: string | null;
  hostingprijs: number | null;
};

const sorts = [
  { key: "naam", label: "Site (A–Z)" },
  { key: "klant", label: "Factuurklant (A–Z)" },
  { key: "prijs", label: "Prijs (hoog–laag)" },
];

export default function SitesView({ sites }: { sites: SiteRij[] }) {
  const [zoek, setZoek] = useState("");
  const [sort, setSort] = useState("naam");

  const heeftEindklanten = sites.some((s) => s.eindKlant);

  const rijen = useMemo(() => {
    const q = zoek.toLowerCase();
    const gefilterd = sites.filter(
      (s) =>
        !q ||
        s.naam.toLowerCase().includes(q) ||
        s.factuurKlant.toLowerCase().includes(q) ||
        (s.eindKlant ?? "").toLowerCase().includes(q),
    );
    return [...gefilterd].sort((a, b) =>
      sort === "naam"
        ? a.naam.localeCompare(b.naam)
        : sort === "klant"
          ? a.factuurKlant.localeCompare(b.factuurKlant)
          : (b.hostingprijs ?? 0) - (a.hostingprijs ?? 0),
    );
  }, [sites, zoek, sort]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={zoek} onChange={setZoek} placeholder="Zoek site of klant…" />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="ml-auto rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-sm text-neutral-700 outline-none focus:border-neutral-300"
        >
          {sorts.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2 md:hidden">
        {rijen.map((s) => (
          <Link
            key={s.id}
            href={`/sites/${s.id}`}
            className="block rounded-lg border border-neutral-200 bg-white p-3"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-neutral-800">{s.naam}</p>
              <p className="tnum shrink-0 text-sm text-neutral-700">
                {s.hostingprijs != null ? `€${s.hostingprijs.toFixed(0)}/j` : "—"}
              </p>
            </div>
            <p className="mt-0.5 text-xs text-neutral-500">
              {s.factuurKlant}
              {s.eindKlant ? ` · eindklant: ${s.eindKlant}` : ""}
            </p>
          </Link>
        ))}
      </div>

      <div className={`${tbl.wrap} hidden md:block`}>
        <div className={tbl.scroll}>
          <table className={tbl.table}>
            <thead>
              <tr>
                <th className={tbl.th}>Site</th>
                <th className={tbl.th}>Factuurklant</th>
                {heeftEindklanten && <th className={tbl.th}>Eindklant</th>}
                <th className={tbl.thNum}>Hosting/jaar</th>
              </tr>
            </thead>
            <tbody>
              {rijen.map((s) => (
                <tr key={s.id} className={tbl.tr}>
                  <td className={tbl.tdName}>
                    <Link href={`/sites/${s.id}`} className={tbl.rowLink}>
                      {s.naam}
                    </Link>
                  </td>
                  <td className={tbl.td}>{s.factuurKlant}</td>
                  {heeftEindklanten && <td className={tbl.td}>{s.eindKlant ?? "—"}</td>}
                  <td className={tbl.tdNum}>
                    {s.hostingprijs != null ? `€${s.hostingprijs.toFixed(0)}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs text-neutral-400">
        {rijen.length} van {sites.length} sites · bedragen excl. btw
      </p>
    </div>
  );
}
