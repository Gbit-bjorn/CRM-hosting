import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { db } from "@/lib/db";
import { updateDomein } from "@/lib/mutations";
import { Veld, veldKlasse, BewaarKnop, KlantOpties } from "@/components/ui/form";
import type { NomeoContact } from "@/lib/nomeo";

const CONTACT_LABELS: Record<string, string> = {
  registrant: "Eigenaar (registrant)",
  on_site: "Whois-contact (on-site)",
  admin: "Admin",
  tech: "Technisch",
  billing: "Facturatie",
};

export const dynamic = "force-dynamic";

function Regel({ label, waarde }: { label: string; waarde: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-neutral-100 py-1.5 last:border-0">
      <span className="text-neutral-500">{label}</span>
      <span className="tnum text-neutral-800">{waarde}</span>
    </div>
  );
}

export default async function DomeinDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [d, klanten] = await Promise.all([
    db.domein.findUnique({ where: { id }, include: { klant: true } }),
    db.klant.findMany({ orderBy: { naam: "asc" }, select: { id: true, naam: true } }),
  ]);
  if (!d) return <p className="text-sm text-neutral-500">Domein niet gevonden.</p>;

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <Link
          href="/domeinen"
          className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-coral-hover"
        >
          <ArrowLeft size={14} /> Domeinen
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight text-charcoal">{d.naam}</h1>
          <a
            href={`https://${d.naam}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-coral-hover"
          >
            site openen <ExternalLink size={13} />
          </a>
        </div>
      </div>

      <section className="rounded-lg border border-neutral-200 bg-white p-4 text-sm">
        <h2 className="mb-2 text-sm font-semibold text-neutral-700">Uit Nomeo (alleen-lezen)</h2>
        <Regel label="Vervaldatum" waarde={d.expireDate ? d.expireDate.toISOString().slice(0, 10) : "—"} />
        <Regel label="Registratie" waarde={d.registrationDate ? d.registrationDate.toISOString().slice(0, 10) : "—"} />
        <Regel label="Auto-renew" waarde={d.autoRenew ? "aan" : "UIT"} />
        <Regel label="Status" waarde={d.status ?? "—"} />
        <Regel label="Inkoop (Nomeo)" waarde={d.inkoopPrijs != null ? `€${d.inkoopPrijs.toFixed(2)}` : "—"} />
      </section>

      {d.laatsteLiveCheck && (
        <section className="rounded-lg border border-neutral-200 bg-white p-4 text-sm">
          <h2 className="mb-2 text-sm font-semibold text-neutral-700">
            Live-situatie{" "}
            <span className="font-normal text-neutral-400">
              (gecheckt {d.laatsteLiveCheck.toISOString().slice(0, 10)})
            </span>
          </h2>
          <Regel label="Draait op" waarde={d.liveWaar ?? "—"} />
          <Regel label="IP" waarde={d.liveIp ?? "—"} />
          <Regel label="HTTP" waarde={d.httpStatus ?? "—"} />
          <Regel label="CMS" waarde={d.cms ?? "—"} />
          {d.registratieStatus && <Regel label="Registratie (whois)" waarde={d.registratieStatus} />}
        </section>
      )}

      {d.nomeoContacts != null && typeof d.nomeoContacts === "object" && (
        <section className="rounded-lg border border-neutral-200 bg-white p-4 text-sm">
          <h2 className="mb-2 text-sm font-semibold text-neutral-700">
            Domeincontacten (Nomeo){" "}
            <span className="font-normal text-neutral-400">— aanpassen kan enkel in het Nomeo-portaal</span>
          </h2>
          <div className="space-y-2">
            {Object.entries(d.nomeoContacts as Record<string, NomeoContact | null>)
              .filter(([, c]) => c != null)
              .map(([type, c]) => (
                <div key={type} className="rounded-md bg-neutral-50 px-2.5 py-1.5">
                  <p className="text-xs text-neutral-400">{CONTACT_LABELS[type] ?? type}</p>
                  <p className="text-neutral-700">
                    {[`${c!.first_name ?? ""} ${c!.last_name ?? ""}`.trim(), c!.company_name, c!.email_address, c!.phone_number]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
              ))}
          </div>
        </section>
      )}

      <form action={updateDomein.bind(null, d.id)} className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-neutral-700">Bewerken</h2>
        <Veld label="Klant">
          <select name="klantId" defaultValue={d.klantId ?? ""} className={veldKlasse}>
            <KlantOpties klanten={klanten} leegLabel="— geen klant —" />
          </select>
        </Veld>
        <Veld label="Verkoopprijs / jaar (excl. btw)">
          <input
            name="verkoopPrijs"
            type="text"
            inputMode="decimal"
            defaultValue={d.verkoopPrijs != null ? String(d.verkoopPrijs) : ""}
            placeholder="bv. 15"
            className={veldKlasse}
          />
        </Veld>
        <Veld label="Notities">
          <textarea name="notities" defaultValue={d.notities ?? ""} rows={3} className={veldKlasse} />
        </Veld>
        <BewaarKnop />
      </form>
    </div>
  );
}
