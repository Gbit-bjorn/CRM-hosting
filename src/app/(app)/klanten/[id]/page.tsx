import Link from "next/link";
import { db } from "@/lib/db";
import { Badge } from "@/components/Badge";

export const dynamic = "force-dynamic";

function Paneel({ titel, children }: { titel: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="mb-2 font-medium text-navy">{titel}</h2>
      {children}
    </section>
  );
}

export default async function KlantDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const k = await db.klant.findUnique({
    where: { id },
    include: {
      contacten: true,
      sites: { include: { eindKlant: true } },
      domeinen: true,
      abonnementen: true,
    },
  });
  if (!k) return <p>Klant niet gevonden.</p>;

  const jaartotaal = k.abonnementen.reduce((s, a) => s + a.jaarbedrag, 0);
  const profiel = k.sites.length > 0 ? "hosting" : k.domeinen.length > 0 ? "domein-only" : "leeg";

  return (
    <div className="space-y-5">
      <div>
        <Link href="/klanten" className="text-sm text-teal-dark hover:underline">
          ← Klanten
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold text-navy">{k.naam}</h1>
          {k.type === "reseller" && <Badge soort="reseller">Reseller</Badge>}
          {profiel === "hosting" && <Badge soort="hosting">Hosting</Badge>}
          {profiel === "domein-only" && <Badge soort="domein">Domein-only</Badge>}
        </div>
        <p className="mt-1 text-sm text-gray-500">
          {k.vatNumber ? `${k.vatNumber} · ` : ""}
          {k.sites.length} site(s) · {k.domeinen.length} domein(en) · €{jaartotaal.toFixed(0)}/jaar
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Paneel titel={`Contacten (${k.contacten.length})`}>
          {k.contacten.length ? (
            <ul className="space-y-1 text-sm">
              {k.contacten.map((c) => (
                <li key={c.id}>
                  {c.naam}
                  {c.email ? ` — ${c.email}` : ""}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">Nog geen contacten.</p>
          )}
        </Paneel>

        <Paneel titel={`Sites (${k.sites.length})`}>
          {k.sites.length ? (
            <ul className="space-y-1 text-sm">
              {k.sites.map((s) => (
                <li key={s.id}>
                  {s.naam}
                  {s.eindKlant ? ` — eindklant: ${s.eindKlant.naam}` : ""}
                  {s.hostingprijs != null ? ` · €${s.hostingprijs.toFixed(0)}/j` : ""}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">Geen hosting-sites.</p>
          )}
        </Paneel>

        <Paneel titel={`Domeinen (${k.domeinen.length})`}>
          {k.domeinen.length ? (
            <ul className="space-y-1 text-sm">
              {k.domeinen.map((d) => (
                <li key={d.id}>
                  {d.naam}
                  {d.expireDate ? ` — vervalt ${d.expireDate.toISOString().slice(0, 10)}` : ""}
                  {!d.autoRenew ? " · auto-renew UIT" : ""}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">Geen domeinen.</p>
          )}
        </Paneel>

        <Paneel titel={`Abonnementen (${k.abonnementen.length})`}>
          {k.abonnementen.length ? (
            <ul className="space-y-1 text-sm">
              {k.abonnementen.map((a) => (
                <li key={a.id}>
                  {a.omschrijving ?? "—"} — €{a.jaarbedrag.toFixed(0)}/jaar
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">Geen abonnementen.</p>
          )}
        </Paneel>
      </div>

      <Paneel titel="Notities">
        <p className="whitespace-pre-wrap text-sm text-gray-700">{k.notities ?? "—"}</p>
      </Paneel>
    </div>
  );
}
