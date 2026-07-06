import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { tbl } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function Sites() {
  const sites = await db.site.findMany({
    include: { factuurKlant: true, eindKlant: true },
    orderBy: { naam: "asc" },
  });

  return (
    <div>
      <PageHeader title="Sites" count={sites.length} />
      <div className={tbl.wrap}>
        <div className={tbl.scroll}>
          <table className={tbl.table}>
            <thead>
              <tr>
                <th className={tbl.th}>Site</th>
                <th className={tbl.th}>Factuurklant</th>
                <th className={tbl.th}>Eindklant</th>
                <th className={tbl.thNum}>Hosting/jaar</th>
              </tr>
            </thead>
            <tbody>
              {sites.map((s) => (
                <tr key={s.id} className={tbl.tr}>
                  <td className={tbl.tdName}>{s.naam}</td>
                  <td className={tbl.td}>{s.factuurKlant?.naam ?? "—"}</td>
                  <td className={tbl.td}>{s.eindKlant?.naam ?? "—"}</td>
                  <td className={tbl.tdNum}>
                    {s.hostingprijs != null ? `€${s.hostingprijs.toFixed(0)}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="mt-2 text-xs text-neutral-400">Bedragen excl. btw</p>
    </div>
  );
}
