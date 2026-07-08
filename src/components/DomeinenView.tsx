"use client";
import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, Check, List, Users, X } from "lucide-react";
import { SearchInput } from "@/components/ui/SearchInput";
import { Badge } from "@/components/ui/Badge";
import { StatusDot, type Tone } from "@/components/ui/StatusDot";
import { tbl } from "@/components/ui/table";
import { verplaatsDomein } from "@/lib/mutations";

export type DomeinRij = {
  id: string;
  naam: string;
  klant: string;
  klantId: string | null;
  expireDate: string | null;
  autoRenew: boolean;
  heeftHosting: boolean;
};

export type KlantOptie = { id: string; naam: string };

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
  const dagen = d.expireDate
    ? (new Date(d.expireDate).getTime() - Date.now()) / 86_400_000
    : null;
  // Met auto-renew aan verlengt het domein vanzelf — een verstreken datum is dan
  // hoogstens verouderde data, geen alarm.
  if (dagen != null && dagen < 0)
    return d.autoRenew ? { tone: "idle", label: "verlengt automatisch" } : { tone: "bad", label: "verlopen" };
  if (dagen != null && dagen < 30)
    return d.autoRenew ? { tone: "ok", label: "verlengt automatisch" } : { tone: "warn", label: "vervalt < 30d" };
  if (!d.autoRenew) return { tone: "warn", label: "auto-renew uit" };
  return { tone: "ok", label: "actief" };
}

/** Inline "verplaats naar andere klant"-actie; abonnement en site verhuizen mee. */
function Verplaats({ domein, klanten }: { domein: DomeinRij; klanten: KlantOptie[] }) {
  const [open, setOpen] = useState(false);
  const [doel, setDoel] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label={`Verplaats ${domein.naam} naar een andere klant`}
        title="Verplaats naar andere klant"
        className="rounded-md border border-neutral-200 p-1.5 text-neutral-500 transition hover:bg-neutral-50 hover:text-charcoal"
      >
        <ArrowRightLeft size={13} />
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-1">
      <select
        value={doel}
        onChange={(e) => setDoel(e.target.value)}
        className="max-w-44 rounded-md border border-neutral-200 bg-white px-1.5 py-1 text-xs text-neutral-700 outline-none focus:border-neutral-300"
      >
        <option value="">— kies klant —</option>
        {klanten
          .filter((k) => k.id !== domein.klantId)
          .map((k) => (
            <option key={k.id} value={k.id}>
              {k.naam}
            </option>
          ))}
      </select>
      <button
        disabled={!doel || pending}
        onClick={() =>
          start(async () => {
            await verplaatsDomein(domein.id, doel);
            setOpen(false);
            router.refresh();
          })
        }
        aria-label="Bevestig verplaatsen"
        className="rounded-md bg-coral p-1.5 text-white transition hover:bg-coral-hover disabled:opacity-40"
      >
        <Check size={13} />
      </button>
      <button
        onClick={() => setOpen(false)}
        aria-label="Annuleer verplaatsen"
        className="rounded-md border border-neutral-200 p-1.5 text-neutral-500 transition hover:bg-neutral-50"
      >
        <X size={13} />
      </button>
    </span>
  );
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
                      {d.expireDate && (
                        <span className="tnum text-xs text-neutral-500">
                          vervalt {d.expireDate.slice(0, 10)}
                        </span>
                      )}
                      <span className="ml-auto">
                        <Verplaats domein={d} klanten={klanten} />
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
                      {d.expireDate && (
                        <span className="tnum text-xs text-neutral-500">
                          vervalt {d.expireDate.slice(0, 10)}
                        </span>
                      )}
                      <Verplaats domein={d} klanten={klanten} />
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
                        <td className={tbl.tdNum}>{d.expireDate ? d.expireDate.slice(0, 10) : "—"}</td>
                        <td className={tbl.td}>
                          <StatusDot tone={s.tone}>{s.label}</StatusDot>
                        </td>
                        <td className={`${tbl.tdNum} relative z-10`}>
                          <Verplaats domein={d} klanten={klanten} />
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
