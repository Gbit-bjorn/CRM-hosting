import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import SitesView from "@/components/SitesView";

export const dynamic = "force-dynamic";

export default async function Sites() {
  const sites = await db.site.findMany({
    include: { factuurKlant: true, eindKlant: true },
    orderBy: { naam: "asc" },
  });

  return (
    <div>
      <PageHeader title="Sites" count={sites.length} />
      <SitesView
        sites={sites.map((s) => ({
          id: s.id,
          naam: s.naam,
          factuurKlant: s.factuurKlant?.naam ?? "—",
          eindKlant: s.eindKlant?.naam ?? null,
          hostingprijs: s.hostingprijs,
        }))}
      />
    </div>
  );
}
