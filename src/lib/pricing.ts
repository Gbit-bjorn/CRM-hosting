// Tariefmodel afgeleid uit mail-bianca-prijsafspraak.md.
// Prijzen zijn later per site/domein bewerkbaar; dit zijn de standaardwaarden.
export const TARIEF = {
  hostingStandaard: 90, // €/jaar per hosting-site
  hostingReseller: 72, // €/jaar per site (−20% resellerkorting)
  domein: 15, // €/jaar per .be-domein (klantprijs)
};

export function hostingPrijs(isReseller: boolean): number {
  return isReseller ? TARIEF.hostingReseller : TARIEF.hostingStandaard;
}
