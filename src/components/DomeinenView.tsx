"use client";
import { useState, useMemo } from "react";
import { SearchInput } from "@/components/ui/SearchInput";
import { Badge } from "@/components/ui/Badge";
import { StatusDot, type Tone } from "@/components/ui/StatusDot";
import { tbl } from "@/components/ui/table";

export type DomeinRij = {
  naam: string;
  klant: string;
  expireDate: string | null;
  autoRenew: boolean;
  heeftHosting: boolean;
};

const filters = [
  { key: "alle", label: "Alle" },
  { key: "geen-renew", label: "Auto-renew uit" },
  { key: "binnenkort", label: "Vervalt < 30d" },
];
const sorts = [
  { key: "vervalt", label: "Vervaldatum (eerst)" },
  { key: "naam", label: "Domein (A–Z)" },
];

function statusVan(d: DomeinRij): { tone: Tone; label: string } {
  if (!d.autoRenew) return { tone: "warn", label: "auto-renew uit" };
  if (d.expireDate) {
    const dagen = (new Date(d.expireDate).getTime() - Date.now()) / 86_400_000;
    if (dagen < 0) return { tone: "bad", label: "verlopen" };
    if (dagen < 30) return { tone: "warn", label: "vervalt < 30d" };
  }
  return { tone: "ok", label: "actief" };
}

export default function DomeinenView({ domeinen }: { domeinen: DomeinRij[] }) {
  const [zoek, setZoek] = useState("");
  const [filter, setFilter] = useState("alle");
  const [sort, setSort] = useState("vervalt");

  const rijen = useMemo(() => {
    const q = zoek.toLowerCase();
    const gefilterd = domeinen.filter((d) => {
      if (q && !d.naam.toLowerCase().includes(q) && !d.klant.toLowerCase().includes(q))
        return false;
      if (filter === "geen-renew") return !d.autoRenew;
      if (filter === "binnenkort") {
        if (!d.expireDate) return false;
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={zoek} onChange={setZoek} placeholder="Zoek domein of klant…" />
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

      <div className={tbl.wrap}>
        <div className={tbl.scroll}>
          <table className={tbl.table}>
            <thead>
              <tr>
                <th className={tbl.th}>Domein</th>
                <th className={tbl.th}>Klant</th>
                <th className={tbl.th}>Type</th>
                <th className={tbl.thNum}>Vervalt</th>
                <th className={tbl.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {rijen.map((d) => {
                const s = statusVan(d);
                return (
                  <tr key={d.naam} className={tbl.tr}>
                    <td className={tbl.tdName}>{d.naam}</td>
                    <td className={tbl.td}>{d.klant}</td>
                    <td className={tbl.td}>
                      <Badge soort={d.heeftHosting ? "hosting" : "domein"}>
                        {d.heeftHosting ? "Hosting" : "Domein"}
                      </Badge>
                    </td>
                    <td className={tbl.tdNum}>{d.expireDate ? d.expireDate.slice(0, 10) : "—"}</td>
                    <td className={tbl.td}>
                      <StatusDot tone={s.tone}>{s.label}</StatusDot>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs text-neutral-400">
        {rijen.length} van {domeinen.length} domeinen
      </p>
    </div>
  );
}
