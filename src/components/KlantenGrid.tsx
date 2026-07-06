"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import { Badge } from "@/components/Badge";

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
] as const;

export default function KlantenGrid({ klanten }: { klanten: Kaart[] }) {
  const [zoek, setZoek] = useState("");
  const [filter, setFilter] = useState<string>("alle");

  const zichtbaar = useMemo(
    () =>
      klanten.filter((k) => {
        if (zoek && !k.naam.toLowerCase().includes(zoek.toLowerCase())) return false;
        if (filter === "hosting") return k.profiel === "hosting";
        if (filter === "domein") return k.profiel === "domein-only";
        if (filter === "reseller") return k.type === "reseller";
        return true;
      }),
    [klanten, zoek, filter],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={zoek}
          onChange={(e) => setZoek(e.target.value)}
          placeholder="Zoek klant…"
          className="w-56 rounded border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-teal"
        />
        <div className="flex gap-1">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-full px-3 py-1 text-sm transition ${
                filter === f.key
                  ? "bg-navy text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <span className="ml-auto text-sm text-gray-500">
          {zichtbaar.length} van {klanten.length}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {zichtbaar.map((k) => (
          <Link
            key={k.id}
            href={`/klanten/${k.id}`}
            className="block rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition hover:border-teal/50 hover:shadow-md"
          >
            <h3 className="mb-2 font-semibold leading-tight text-navy">{k.naam}</h3>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {k.type === "reseller" && <Badge soort="reseller">Reseller</Badge>}
              {k.profiel === "hosting" && <Badge soort="hosting">Hosting</Badge>}
              {k.profiel === "domein-only" && <Badge soort="domein">Domein-only</Badge>}
            </div>
            <dl className="grid grid-cols-3 gap-2 text-sm">
              <div>
                <dt className="text-gray-400">Sites</dt>
                <dd className="font-medium">{k.sites}</dd>
              </div>
              <div>
                <dt className="text-gray-400">Domeinen</dt>
                <dd className="font-medium">{k.domeinen}</dd>
              </div>
              <div>
                <dt className="text-gray-400">Per jaar</dt>
                <dd className="font-medium">€{k.jaartotaal.toFixed(0)}</dd>
              </div>
            </dl>
            {k.contact && <p className="mt-2 truncate text-xs text-gray-500">{k.contact}</p>}
          </Link>
        ))}
      </div>
    </div>
  );
}
