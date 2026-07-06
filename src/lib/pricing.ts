// Tariefmodel (alle bedragen EXCL. btw). Afgeleid uit mail-bianca-prijsafspraak.md
// en de Nomeo-retailprijzen. Later per site/domein bewerkbaar.
export const TARIEF = {
  hostingStandaard: 90, // €/jaar per hosting-site
  hostingReseller: 72, // €/jaar per site (−20% resellerkorting)
  domein: { be: 15, nl: 15, eu: 15, com: 19, default: 19 } as Record<string, number>,
};

/** Klantprijs van een domein per extensie (excl. btw). */
export function domeinPrijs(tld: string | null): number {
  const t = (tld ?? "").toLowerCase();
  return TARIEF.domein[t] ?? TARIEF.domein.default;
}

export function hostingPrijs(isReseller: boolean): number {
  return isReseller ? TARIEF.hostingReseller : TARIEF.hostingStandaard;
}
