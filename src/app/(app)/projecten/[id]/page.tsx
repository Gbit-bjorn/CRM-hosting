import Link from "next/link";
import { ArrowLeft, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { comanageActief, listInvoices, listOffers } from "@/lib/comanage";
import { Badge, type BadgeSoort } from "@/components/ui/Badge";
import { Veld, veldKlasse, BewaarKnop } from "@/components/ui/form";
import {
  updateProject,
  verwijderProject,
  addNotitie,
  updateNotitie,
  deleteNotitie,
} from "@/lib/mutations";

export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<string, { soort: BadgeSoort; label: string }> = {
  gepland: { soort: "idle", label: "gepland" },
  actief: { soort: "ok", label: "actief" },
  gepauzeerd: { soort: "warn", label: "gepauzeerd" },
  afgerond: { soort: "domein", label: "afgerond" },
};

const dag = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

function Paneel({ titel, children }: { titel: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-4">
      <h2 className="mb-2 text-sm font-semibold text-neutral-700">{titel}</h2>
      {children}
    </section>
  );
}

function NotitieVelden({
  defaults,
}: {
  defaults?: { type: string; titel: string; datum: Date; auteur: string | null; inhoud: string };
}) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-4">
        <Veld label="Type">
          <select name="type" defaultValue={defaults?.type ?? "notitie"} className={veldKlasse}>
            <option value="notitie">Notitie</option>
            <option value="verslag">Meetingverslag</option>
          </select>
        </Veld>
        <Veld label="Titel">
          <input name="titel" defaultValue={defaults?.titel ?? ""} className={veldKlasse} required />
        </Veld>
        <Veld label="Datum">
          <input
            type="date"
            name="datum"
            defaultValue={defaults ? dag(defaults.datum) : dag(new Date())}
            className={veldKlasse}
          />
        </Veld>
        <Veld label="Auteur">
          <select name="auteur" defaultValue={defaults?.auteur ?? ""} className={veldKlasse}>
            <option value="">—</option>
            <option value="Bjorn">Bjorn</option>
            <option value="Gill">Gill</option>
            <option value="Jarn">Jarn</option>
          </select>
        </Veld>
      </div>
      <Veld label="Inhoud">
        <textarea name="inhoud" defaultValue={defaults?.inhoud ?? ""} rows={6} className={veldKlasse} required />
      </Veld>
    </>
  );
}

export default async function ProjectDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await db.project.findUnique({
    where: { id },
    include: {
      klant: { select: { id: true, naam: true, comanageId: true } },
      notities: { orderBy: { datum: "desc" } },
      accounts: { orderBy: { dienst: "asc" } },
    },
  });
  if (!p) return <p className="text-sm text-neutral-500">Project niet gevonden.</p>;

  // CoManage-context (alleen-lezen): facturen en offertes van deze klant.
  // De CoManage-API kent geen projecten — dit is de best beschikbare koppeling.
  const [facturen, offertes] =
    p.klant.comanageId && comanageActief()
      ? await Promise.all([
          listInvoices()
            .then((xs) => xs.filter((f) => !f.trashed && String(f.contact?.number) === p.klant.comanageId))
            .catch((e) => {
              console.error("CoManage facturen:", e);
              return null;
            }),
          listOffers()
            .then((xs) => xs.filter((o) => !o.trashed && String(o.contact?.number) === p.klant.comanageId))
            .catch((e) => {
              console.error("CoManage offertes:", e);
              return null;
            }),
        ])
      : [null, null];

  const badge = STATUS_BADGE[p.status];

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <Link href="/projecten" className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-coral-hover">
          <ArrowLeft size={14} /> Projecten
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2.5">
          <h1 className="text-xl font-semibold tracking-tight text-charcoal">{p.naam}</h1>
          <Badge soort={badge.soort}>{badge.label}</Badge>
        </div>
        <p className="mt-1 text-sm text-neutral-500">
          Klant:{" "}
          <Link href={`/klanten/${p.klant.id}`} className="text-coral-hover hover:underline">
            {p.klant.naam}
          </Link>
        </p>
      </div>

      <form action={updateProject.bind(null, p.id)} className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-neutral-700">Project bewerken</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Veld label="Naam">
            <input name="naam" defaultValue={p.naam} className={veldKlasse} />
          </Veld>
          <Veld label="Status">
            <select name="status" defaultValue={p.status} className={veldKlasse}>
              <option value="gepland">Gepland</option>
              <option value="actief">Actief</option>
              <option value="gepauzeerd">Gepauzeerd</option>
              <option value="afgerond">Afgerond</option>
            </select>
          </Veld>
          <Veld label="Startdatum">
            <input type="date" name="startDatum" defaultValue={dag(p.startDatum)} className={veldKlasse} />
          </Veld>
          <Veld label="Einddatum">
            <input type="date" name="eindDatum" defaultValue={dag(p.eindDatum)} className={veldKlasse} />
          </Veld>
        </div>
        <Veld label="Omschrijving">
          <textarea name="omschrijving" defaultValue={p.omschrijving ?? ""} rows={3} className={veldKlasse} />
        </Veld>
        <BewaarKnop />
      </form>

      <Paneel titel={`Notities & verslagen (${p.notities.length})`}>
        <details className="mb-4 rounded-md border border-neutral-200 bg-neutral-50 p-3">
          <summary className="cursor-pointer text-sm font-medium text-neutral-700">Nieuwe notitie of verslag</summary>
          <form action={addNotitie.bind(null, p.id)} className="mt-3 space-y-3">
            <NotitieVelden />
            <BewaarKnop>Toevoegen</BewaarKnop>
          </form>
        </details>

        {p.notities.length === 0 && <p className="text-sm text-neutral-400">Nog geen notities.</p>}
        <ul className="space-y-4">
          {p.notities.map((n) => (
            <li key={n.id} className="border-b border-neutral-100 pb-4 last:border-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge soort={n.type === "verslag" ? "reseller" : "domein"}>
                  {n.type === "verslag" ? "verslag" : "notitie"}
                </Badge>
                <span className="text-sm font-medium text-neutral-800">{n.titel}</span>
                <span className="tnum text-xs text-neutral-500">
                  {dag(n.datum)}
                  {n.auteur ? ` · ${n.auteur}` : ""}
                </span>
                <form action={deleteNotitie.bind(null, n.id, p.id)} className="ml-auto">
                  <button className="text-neutral-400 hover:text-bad-text" aria-label="Verwijder notitie">
                    <Trash2 size={14} />
                  </button>
                </form>
              </div>
              <p className="mt-1.5 whitespace-pre-wrap text-sm text-neutral-700">{n.inhoud}</p>
              <details className="mt-1.5">
                <summary className="cursor-pointer text-xs text-neutral-400 hover:text-neutral-600">bewerken</summary>
                <form action={updateNotitie.bind(null, n.id, p.id)} className="mt-2 space-y-3 rounded-md border border-neutral-200 bg-neutral-50 p-3">
                  <NotitieVelden defaults={n} />
                  <BewaarKnop />
                </form>
              </details>
            </li>
          ))}
        </ul>
      </Paneel>

      {p.accounts.length > 0 && (
        <Paneel titel={`Gekoppelde accounts (${p.accounts.length})`}>
          <ul className="space-y-1 text-sm text-neutral-700">
            {p.accounts.map((a) => (
              <li key={a.id}>
                {a.dienst}
                {a.gebruikersnaam ? ` — ${a.gebruikersnaam}` : ""}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-neutral-500">
            Beheer (incl. wachtwoorden) op de{" "}
            <Link href={`/klanten/${p.klant.id}`} className="text-coral-hover hover:underline">
              klantpagina
            </Link>
            .
          </p>
        </Paneel>
      )}

      {(facturen || offertes) && (
        <Paneel titel="CoManage-context (alleen-lezen)">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <h3 className="mb-1 text-xs font-medium text-neutral-500">Facturen ({facturen?.length ?? 0})</h3>
              <ul className="tnum space-y-1 text-sm text-neutral-700">
                {(facturen ?? []).slice(0, 10).map((f) => (
                  <li key={f.number} className="flex justify-between gap-2">
                    <span className="truncate">
                      {f.invoice_number} {f.title ? `· ${f.title}` : ""}
                    </span>
                    <span className="shrink-0 text-neutral-500">
                      €{(f.totals?.total_ex_vat ?? 0).toFixed(0)} · {f.status}
                    </span>
                  </li>
                ))}
                {(facturen?.length ?? 0) === 0 && <li className="text-neutral-400">Geen facturen.</li>}
              </ul>
            </div>
            <div>
              <h3 className="mb-1 text-xs font-medium text-neutral-500">Offertes ({offertes?.length ?? 0})</h3>
              <ul className="tnum space-y-1 text-sm text-neutral-700">
                {(offertes ?? []).slice(0, 10).map((o) => (
                  <li key={o.number} className="flex justify-between gap-2">
                    <span className="truncate">
                      {o.offer_number} {o.title ? `· ${o.title}` : ""}
                    </span>
                    <span className="shrink-0 text-neutral-500">
                      €{(o.totals?.total_ex_vat ?? 0).toFixed(0)} · {o.status}
                    </span>
                  </li>
                ))}
                {(offertes?.length ?? 0) === 0 && <li className="text-neutral-400">Geen offertes.</li>}
              </ul>
            </div>
          </div>
        </Paneel>
      )}

      <details className="rounded-lg border border-neutral-200 bg-white p-4">
        <summary className="cursor-pointer text-sm text-neutral-500 hover:text-bad-text">Project verwijderen…</summary>
        <p className="mt-2 text-sm text-neutral-600">
          Verwijdert het project en alle notities/verslagen. Accounts blijven bij de klant staan.
        </p>
        <form action={verwijderProject.bind(null, p.id, p.klant.id)} className="mt-2">
          <button className="rounded-md border border-bad-text/30 px-3 py-2 text-sm font-medium text-bad-text hover:bg-bad-bg">
            Ja, verwijder dit project
          </button>
        </form>
      </details>
    </div>
  );
}
