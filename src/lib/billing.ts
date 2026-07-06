// G-Bit factureert pas vanaf februari 2026; alles daarvoor was voor edu-tech.
export const FACTURATIE_START = new Date("2026-02-01");

export function actieDatum(renewalDate: Date): Date {
  const d = new Date(renewalDate);
  d.setMonth(d.getMonth() - 1);
  return d;
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
