"use client";
import { useState, useMemo } from "react";
import { Badge } from "@/components/Badge";

export type DomeinRij = {
  naam: string;
  klant: string;
  expireDate: string | null; // ISO of null
  autoRenew: boolean;
  status: string | null;
  heeftHosting: boolean;
};

const filters = [
  { key: "alle", label: "Alle" },
  { key: "geen-renew", label: "Auto-renew UIT" },
  { key: "binnenkort", label: "Vervalt < 30d" },
] as const;

function binnenkort(iso: string | null) {
  if (!iso) return false;
  return (new Date(iso).getTime() - Date.now()) / 86_400_000 < 30;
}

export default function DomeinenTabel({ domeinen }: { domeinen: DomeinRij[] }) {
  const [zoek, setZoek] = useState("");
  const [filter, setFilter] = useState<string>("alle");

  const zichtbaar = useMemo(
    () =>
      domeinen.filter((d) => {
        const q = zoek.toLowerCase();
        if (q && !d.naam.toLowerCase().includes(q) && !d.klant.toLowerCase().includes(q))
          return false;
        if (filter === "geen-renew") return !d.autoRenew;
        if (filter === "binnenkort") return binnenkort(d.expireDate);
        return true;
      }),
    [domeinen, zoek, filter],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={zoek}
          onChange={(e) => setZoek(e.target.value)}
          placeholder="Zoek domein of klant…"
          className="w-64 rounded border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-teal"
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
          {zichtbaar.length} van {domeinen.length}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="py-2 pr-4 font-medium">Domein</th>
              <th className="py-2 pr-4 font-medium">Klant</th>
              <th className="py-2 pr-4 font-medium">Type</th>
              <th className="py-2 pr-4 font-medium">Vervalt</th>
              <th className="py-2 pr-4 font-medium">Auto-renew</th>
              <th className="py-2 pr-4 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {zichtbaar.map((d) => (
              <tr key={d.naam} className="border-b hover:bg-mist">
                <td className="py-2 pr-4 font-medium text-navy">{d.naam}</td>
                <td className="py-2 pr-4">{d.klant}</td>
                <td className="py-2 pr-4">
                  {d.heeftHosting ? (
                    <Badge soort="hosting">Hosting</Badge>
                  ) : (
                    <Badge soort="domein">Domein</Badge>
                  )}
                </td>
                <td className="py-2 pr-4">
                  {d.expireDate ? (
                    <span className={binnenkort(d.expireDate) ? "font-medium text-red-600" : ""}>
                      {d.expireDate.slice(0, 10)}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="py-2 pr-4">
                  {d.autoRenew ? (
                    "aan"
                  ) : (
                    <span className="font-medium text-red-600">UIT</span>
                  )}
                </td>
                <td className="py-2 pr-4">{d.status ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
