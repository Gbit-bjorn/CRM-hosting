import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function Sectie({ titel, items }: { titel: string; items: string[] }) {
  return (
    <div>
      <h2 className="font-medium">
        {titel} ({items.length})
      </h2>
      <ul className="list-disc pl-5 text-sm">
        {items.map((i, n) => (
          <li key={n}>{i}</li>
        ))}
      </ul>
    </div>
  );
}

export default async function KlantDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const k = await db.klant.findUnique({
    where: { id },
    include: { contacten: true, sites: true, domeinen: true, abonnementen: true },
  });
  if (!k) return <p>Klant niet gevonden.</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold">{k.naam}</h1>
      <p className="text-sm text-gray-600">
        Type: {k.type}
        {k.vatNumber ? ` · ${k.vatNumber}` : ""}
      </p>
      <Sectie
        titel="Contacten"
        items={k.contacten.map((c) => `${c.naam}${c.email ? ` — ${c.email}` : ""}`)}
      />
      <Sectie titel="Sites" items={k.sites.map((s) => s.naam)} />
      <Sectie
        titel="Domeinen"
        items={k.domeinen.map(
          (d) =>
            `${d.naam}${d.expireDate ? ` — vervalt ${d.expireDate.toISOString().slice(0, 10)}` : ""}`,
        )}
      />
      <Sectie
        titel="Abonnementen"
        items={k.abonnementen.map((a) => `${a.omschrijving ?? ""} — €${a.jaarbedrag.toFixed(2)}/jaar`)}
      />
      <div>
        <h2 className="font-medium">Notities</h2>
        <p className="whitespace-pre-wrap text-sm">{k.notities ?? "—"}</p>
      </div>
    </div>
  );
}
