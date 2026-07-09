import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { maakKlant } from "@/lib/mutations";
import { Veld, veldKlasse, BewaarKnop } from "@/components/ui/form";

export default function NieuweKlant() {
  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <Link
          href="/klanten"
          className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-coral-hover"
        >
          <ArrowLeft size={14} /> Klanten
        </Link>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-charcoal">Nieuwe klant</h1>
      </div>

      <form action={maakKlant} className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4">
        <Veld label="Naam (verplicht)">
          <input name="naam" required placeholder="bv. Gelateria Giuditta" className={veldKlasse} />
        </Veld>
        <Veld label="Type">
          <select name="type" defaultValue="direct" className={veldKlasse}>
            <option value="direct">direct</option>
            <option value="reseller">reseller</option>
            <option value="intern">intern</option>
          </select>
        </Veld>
        <Veld label="Btw-nummer (optioneel)">
          <input name="vatNumber" placeholder="BE0123456789" className={veldKlasse} />
        </Veld>
        <Veld label="Adres (optioneel)">
          <input name="adres" placeholder="Straat 1, 3000 Leuven" className={veldKlasse} />
        </Veld>
        <BewaarKnop />
      </form>
      <p className="text-xs text-neutral-400">
        Domeinen en sites koppel je daarna via hun eigen pagina (Verplaats / Klant kiezen).
      </p>
    </div>
  );
}
