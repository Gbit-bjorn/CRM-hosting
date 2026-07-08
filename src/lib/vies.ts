// VIES — officiële EU-API om btw-nummers te valideren (gratis, geen key).
// Geeft naast geldigheid ook de officiële bedrijfsnaam en het adres terug.
// Docs: https://ec.europa.eu/taxation_customs/vies/#/technical-information

export type ViesResultaat = {
  valid: boolean;
  name: string | null;
  address: string | null;
};

/** Normaliseer naar "BE0123456789"-vorm (hoofdletters, zonder punten/spaties). */
export function normaliseerBtw(vat: string | null | undefined): string | null {
  const m = (vat ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return /^[A-Z]{2}[0-9A-Z]{2,}$/.test(m) ? m : null;
}

/** Valideer één btw-nummer bij VIES; null bij ongeldig formaat of als VIES niet antwoordt. */
export async function checkVat(vat: string): Promise<ViesResultaat | null> {
  const genorm = normaliseerBtw(vat);
  if (!genorm) return null;
  try {
    const res = await fetch(
      "https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ countryCode: genorm.slice(0, 2), vatNumber: genorm.slice(2) }),
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!res.ok) return null;
    const j = await res.json();
    return {
      valid: j.valid === true,
      name: j.name && j.name !== "---" ? j.name : null,
      address: j.address && j.address !== "---" ? j.address.replace(/\n/g, ", ") : null,
    };
  } catch {
    return null; // VIES is geregeld traag/offline — dan gewoon geen oordeel
  }
}
