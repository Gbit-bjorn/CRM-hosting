// G-Bit factureert pas vanaf februari 2026; verlengingen die vóór maart 2026
// vervielen waren nog voor edu-tech en horen niet op de radar.
export const FACTURATIE_START = new Date("2026-02-01");
const EIGEN_RENEWALS_VANAF = new Date("2026-03-01");

// Nomeo rekent G-Bit zelf al vóór de vervaldatum aan; wij factureren de klant
// 45 dagen (± 1,5 maand) vooraf zodat onze factuur buiten is vóór wij betalen.
export const LEAD_DAGEN = 45;

export function actieDatum(renewalDate: Date): Date {
  const d = new Date(renewalDate);
  d.setDate(d.getDate() - LEAD_DAGEN);
  return d;
}

/** Hoort deze verlenging bij G-Bit (true) of nog bij edu-tech (false)? */
export function isEigenFacturatie(renewalDate: Date): boolean {
  return renewalDate >= EIGEN_RENEWALS_VANAF;
}

type Item = { actieDatum: Date; status: string };

export function radar<T extends Item>(vandaag: Date, momenten: T[]) {
  const open = momenten.filter((m) => m.status !== "betaald");
  const grens = new Date(vandaag);
  grens.setDate(grens.getDate() + 90);
  const zelfdeMaand = (a: Date) =>
    a.getFullYear() === vandaag.getFullYear() && a.getMonth() === vandaag.getMonth();

  const dezeMaand = open
    .filter((m) => zelfdeMaand(m.actieDatum))
    .sort((a, b) => +a.actieDatum - +b.actieDatum);
  const komende90 = open
    .filter((m) => m.actieDatum >= vandaag && m.actieDatum <= grens && !zelfdeMaand(m.actieDatum))
    .sort((a, b) => +a.actieDatum - +b.actieDatum);

  return { dezeMaand, komende90 };
}
