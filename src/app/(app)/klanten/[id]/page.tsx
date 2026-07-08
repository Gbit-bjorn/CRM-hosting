import Link from "next/link";
import { ArrowLeft, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/Badge";
import { Veld, veldKlasse, BewaarKnop } from "@/components/ui/form";
import { updateKlant, addContact, deleteContact } from "@/lib/mutations";

export const dynamic = "force-dynamic";

function Paneel({ titel, children }: { titel: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-4">
      <h2 className="mb-2 text-sm font-semibold text-neutral-700">{titel}</h2>
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
      sites: { orderBy: { naam: "asc" } },
      beheerSites: { orderBy: { naam: "asc" }, include: { factuurKlant: true } },
      domeinen: { orderBy: { naam: "asc" } },
      abonnementen: true,
    },
  });
  if (!k) return <p className="text-sm text-neutral-500">Klant niet gevonden.</p>;

  const jaartotaal = k.abonnementen.reduce((s, a) => s + a.jaarbedrag, 0);
  const profiel = k.sites.length > 0 ? "hosting" : k.domeinen.length > 0 ? "domein-only" : "leeg";

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <Link href="/klanten" className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-coral-hover">
          <ArrowLeft size={14} /> Klanten
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2.5">
          <h1 className="text-xl font-semibold tracking-tight text-charcoal">{k.naam}</h1>
          {k.type === "reseller" && <Badge soort="reseller">Reseller</Badge>}
          {profiel === "hosting" && <Badge soort="hosting">Hosting</Badge>}
          {profiel === "domein-only" && <Badge soort="domein">Domein-only</Badge>}
          {k.leverancierStatus === "vereist" && <Badge soort="warn">Leveranciersregistratie vereist</Badge>}
          {k.leverancierStatus === "aangevraagd" && <Badge soort="warn">Leveranciersregistratie aangevraagd</Badge>}
          {k.leverancierStatus === "geregistreerd" && <Badge soort="ok">Leverancier geregistreerd</Badge>}
        </div>
        <p className="tnum mt-1 text-sm text-neutral-500">
          {k.sites.length} site(s) · {k.domeinen.length} domein(en) · €{jaartotaal.toFixed(0)}/jaar excl. btw
        </p>
      </div>

      <form action={updateKlant.bind(null, k.id)} className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-neutral-700">Gegevens bewerken</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Veld label="Naam">
            <input name="naam" defaultValue={k.naam} className={veldKlasse} />
          </Veld>
          <Veld label="Type">
            <select name="type" defaultValue={k.type} className={veldKlasse}>
              <option value="direct">Direct</option>
              <option value="reseller">Reseller</option>
              <option value="intern">Intern</option>
            </select>
          </Veld>
          <Veld label="Btw-nummer">
            <input name="vatNumber" defaultValue={k.vatNumber ?? ""} className={veldKlasse} />
          </Veld>
          <Veld label="Adres">
            <input name="adres" defaultValue={k.adres ?? ""} className={veldKlasse} />
          </Veld>
          <Veld label="Leveranciersregistratie (bij gemeentes/overheden)">
            <select name="leverancierStatus" defaultValue={k.leverancierStatus} className={veldKlasse}>
              <option value="nvt">Niet van toepassing</option>
              <option value="vereist">Vereist — nog aan te vragen</option>
              <option value="aangevraagd">Aangevraagd — wachten op goedkeuring</option>
              <option value="geregistreerd">Geregistreerd — factureren kan</option>
            </select>
          </Veld>
        </div>
        <Veld label="Notities">
          <textarea name="notities" defaultValue={k.notities ?? ""} rows={3} className={veldKlasse} />
        </Veld>
        <BewaarKnop />
      </form>

      <Paneel titel={`Contacten (${k.contacten.length})`}>
        <ul className="mb-3 space-y-1 text-sm text-neutral-700">
          {k.contacten.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3">
              <span>
                {c.naam}
                {c.rol ? ` · ${c.rol}` : ""}
                {c.email ? ` — ${c.email}` : ""}
                {c.telefoon ? ` · ${c.telefoon}` : ""}
              </span>
              <form action={deleteContact.bind(null, c.id, k.id)}>
                <button className="text-neutral-400 hover:text-bad-text" aria-label="Verwijder contact">
                  <Trash2 size={14} />
                </button>
              </form>
            </li>
          ))}
          {k.contacten.length === 0 && <li className="text-neutral-400">Nog geen contacten.</li>}
        </ul>
        <form action={addContact.bind(null, k.id)} className="flex flex-wrap items-end gap-2">
          <input name="naam" placeholder="Naam" className={`${veldKlasse} w-40`} />
          <input name="email" placeholder="E-mail" className={`${veldKlasse} w-52`} />
          <input name="telefoon" placeholder="Telefoon" className={`${veldKlasse} w-36`} />
          <input name="rol" placeholder="Rol" className={`${veldKlasse} w-28`} />
          <button className="rounded-md border border-neutral-200 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50">
            Toevoegen
          </button>
        </form>
      </Paneel>

      <div className="grid gap-4 md:grid-cols-2">
        <Paneel titel={`Sites (${k.sites.length})`}>
          {k.sites.length ? (
            <ul className="space-y-1 text-sm">
              {k.sites.map((s) => (
                <li key={s.id}>
                  <Link href={`/sites/${s.id}`} className="text-coral-hover hover:underline">
                    {s.naam}
                  </Link>
                  {s.hostingprijs != null ? <span className="tnum text-neutral-500"> · €{s.hostingprijs.toFixed(0)}/j</span> : ""}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-neutral-400">Geen hosting-sites.</p>
          )}
        </Paneel>

        {k.beheerSites.length > 0 && (
          <Paneel titel={`Sites in beheer (${k.beheerSites.length})`}>
            <p className="mb-2 text-xs text-neutral-500">
              Deze klant doet enkel het beheer; de factuur gaat naar de vermelde factuurklant.
            </p>
            <ul className="space-y-1 text-sm">
              {k.beheerSites.map((s) => (
                <li key={s.id}>
                  <Link href={`/sites/${s.id}`} className="text-coral-hover hover:underline">
                    {s.naam}
                  </Link>
                  <span className="text-neutral-500"> · factuur → {s.factuurKlant.naam}</span>
                </li>
              ))}
            </ul>
          </Paneel>
        )}

        <Paneel titel={`Domeinen (${k.domeinen.length})`}>
          {k.domeinen.length ? (
            <ul className="space-y-1 text-sm">
              {k.domeinen.map((d) => (
                <li key={d.id} className="tnum">
                  <Link href={`/domeinen/${d.id}`} className="text-coral-hover hover:underline">
                    {d.naam}
                  </Link>
                  {d.expireDate ? <span className="text-neutral-500"> · {d.expireDate.toISOString().slice(0, 10)}</span> : ""}
                  {!d.autoRenew ? <span className="text-bad-text"> · auto-renew uit</span> : ""}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-neutral-400">Geen domeinen.</p>
          )}
        </Paneel>
      </div>
    </div>
  );
}
