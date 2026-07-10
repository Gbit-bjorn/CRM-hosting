import Link from "next/link";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge, type BadgeSoort } from "@/components/ui/Badge";

export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<string, { soort: BadgeSoort; label: string }> = {
  gepland: { soort: "idle", label: "gepland" },
  actief: { soort: "ok", label: "actief" },
  gepauzeerd: { soort: "warn", label: "gepauzeerd" },
  afgerond: { soort: "domein", label: "afgerond" },
};

const FILTERS = ["alle", "actief", "gepland", "gepauzeerd", "afgerond"] as const;

export default async function Projecten({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const filter = FILTERS.includes(status as (typeof FILTERS)[number]) ? status! : "alle";

  const projecten = await db.project.findMany({
    where: filter === "alle" ? {} : { status: filter as "gepland" | "actief" | "gepauzeerd" | "afgerond" },
    include: {
      klant: { select: { id: true, naam: true } },
      notities: { orderBy: { datum: "desc" }, take: 1, select: { datum: true } },
      _count: { select: { notities: true, accounts: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div>
      <PageHeader title="Projecten" count={projecten.length} />

      <div className="mb-4 flex flex-wrap gap-1">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={f === "alle" ? "/projecten" : `/projecten?status=${f}`}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
              filter === f
                ? "bg-charcoal text-white"
                : "border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
            }`}
          >
            {f}
          </Link>
        ))}
      </div>

      {projecten.length === 0 ? (
        <p className="text-sm text-neutral-500">
          Geen projecten{filter !== "alle" ? ` met status "${filter}"` : ""}. Maak er een aan via de klantpagina.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-neutral-50 text-left text-xs text-neutral-500">
              <tr>
                <th className="px-3 py-2 font-medium">Project</th>
                <th className="px-3 py-2 font-medium">Klant</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="tnum px-3 py-2 text-right font-medium">Notities</th>
                <th className="px-3 py-2 font-medium">Laatste notitie</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {projecten.map((p) => {
                const b = STATUS_BADGE[p.status];
                return (
                  <tr key={p.id} className="hover:bg-neutral-50">
                    <td className="px-3 py-2">
                      <Link href={`/projecten/${p.id}`} className="font-medium text-coral-hover hover:underline">
                        {p.naam}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <Link href={`/klanten/${p.klant.id}`} className="text-neutral-700 hover:underline">
                        {p.klant.naam}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <Badge soort={b.soort}>{b.label}</Badge>
                    </td>
                    <td className="tnum px-3 py-2 text-right text-neutral-600">{p._count.notities}</td>
                    <td className="tnum px-3 py-2 text-neutral-500">
                      {p.notities[0] ? p.notities[0].datum.toISOString().slice(0, 10) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
