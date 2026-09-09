// Facturatieronde: bouwt per klant de vier controleblokken op uit de live data.
// Pure logica (geen fetches), zodat de pagina en de tests dezelfde punten zien.
//
// Tijdelijk voor de opkuisronde van september 2026 — zie RONDE voor de sleutel
// waaronder de stand in de Instelling-tabel staat. Opruimen = deze module, de
// pagina, de werkbank, de API-route en de Sidebar-regel weg, plus de rijen
// `DELETE FROM "Instelling" WHERE key LIKE 'ronde:2026-09:%'`.
import { isEigenFacturatie } from "./billing";
import { coAdresVan, normAdres, type BronWaarde, type KlantRij } from "./controle";
import type { CoContact } from "./comanage";
import type { NomeoClient } from "./nomeo";
import { normaliseerBtw } from "./vies";

export const RONDE = "ronde:2026-09";
export const rondeSleutel = (klantId: string) => `${RONDE}:${klantId}`;

/** Klanten waarbij een overheid of school pas betaalt na leveranciersregistratie. */
const PUBLIEK =
  /school|scholen|gemeente|ecole|école|instituut|onderwijs|vzw|elz|eerstelijns|apothekers|commune|museum|academie/i;

export type BlokId = "nomeo" | "gegevens" | "comanage" | "factuur";
export type Toon = "bad" | "warn" | "info";

/** Eén controlepunt. `open` komt uit de live data; de mens kan het enkel afhandelen. */
export type Punt = {
  sleutel: string;
  titel: string;
  /** Vaste tekst rechts van de titel, bv. een vervaldatum of het soort regel. */
  bijschrift?: string;
  /** Waarom dit punt openstaat, of de waarde die het CRM kent. */
  uitleg: string[];
  toon: Toon;
  open: boolean;
  /** Factuurregels kunnen rechtstreeks op gefactureerd gezet worden. */
  momentId?: string;
};

export type Blok = { id: BlokId; titel: string; punten: Punt[] };

export type Dossier = {
  id: string;
  naam: string;
  type: string;
  comanageId: string | null;
  nomeoId: string | null;
  notities: string | null;
  aantalDomeinen: number;
  aantalSites: number;
  blokken: Blok[];
};

export type DomeinRij = {
  id: string;
  naam: string;
  klantId: string | null;
  expireDate: Date | null;
  status: string | null;
  autoRenew: boolean;
  nomeoId: string | null;
  nomeoContacts: unknown;
  notities: string | null;
  opOnzeServer: boolean | null;
  httpStatus: string | null;
  registratieStatus: string | null;
  laatsteLiveCheck: Date | null;
};

export type MomentRij = {
  id: string;
  actieDatum: Date;
  status: string;
  abonnement: { klantId: string; omschrijving: string | null; renewalDate: Date };
};

export type KlantVol = KlantRij & {
  notities: string | null;
  leverancierStatus: string;
  contacten: { naam: string; email: string | null }[];
};

export type Invoer = {
  vandaag: Date;
  klanten: KlantVol[];
  domeinen: DomeinRij[];
  momenten: MomentRij[];
  /** Namen van sites met hosting bij ons — bepaalt of een regel hosting bevat. */
  siteNamen: Set<string>;
  /** Per klant het aantal hosting-sites, enkel om te tonen. */
  sitesPerKlant: Map<string, number>;
  coContacts: CoContact[] | null;
  nomeoKlanten: NomeoClient[] | null;
};

const dm = (d: Date | null | undefined) =>
  d ? d.toISOString().slice(0, 10).split("-").reverse().join("/") : "onbekend";

/** Verwijst een Nomeo-domeincontact nog naar EDU-TECH of Casper? (overname-vervuiling) */
function verouderdContact(nomeoContacts: unknown): boolean {
  if (!nomeoContacts) return false;
  const s = JSON.stringify(nomeoContacts).toLowerCase();
  return s.includes("edu-tech") || s.includes("casper");
}

function nomeoBlok(domeinen: DomeinRij[], vandaag: Date): Blok {
  const punten = domeinen.map((d): Punt => {
    const uitleg: string[] = [];
    let toon: Toon = "info";

    if (!d.nomeoId) {
      uitleg.push("Staat niet in Nomeo — nakijken waar dit domein dan wel geregistreerd is.");
      toon = "bad";
    }
    if (d.status === "Active" && d.expireDate && d.expireDate < vandaag) {
      uitleg.push(
        `Vervaldatum ${dm(d.expireDate)} is verstreken maar de status staat nog op Active — sync verouderd of net verlengd?`,
      );
      if (toon !== "bad") toon = "warn";
    }
    if (!d.autoRenew) {
      uitleg.push("Geen automatische verlenging — dit domein valt weg als niemand ingrijpt.");
      if (toon !== "bad") toon = "warn";
    }
    if (verouderdContact(d.nomeoContacts)) {
      uitleg.push("Domeincontact in Nomeo staat nog op EDU-TECH of Casper — moet G-Bit worden.");
    }
    if (d.notities) uitleg.push(`CRM-notitie: ${d.notities}`);

    const signalen = uitleg.filter((u) => !u.startsWith("CRM-notitie"));
    return {
      sleutel: `nomeo:${d.naam}`,
      titel: d.naam,
      bijschrift: `vervalt ${dm(d.expireDate)} · ${d.status ?? "status onbekend"}`,
      uitleg: signalen.length ? uitleg : ["Vervaldatum, status en contactgegevens zien er in orde uit.", ...uitleg],
      toon,
      open: signalen.length > 0,
    };
  });
  return { id: "nomeo", titel: "Nomeo — klopt het nog?", punten };
}

function gegevensBlok(
  k: KlantVol,
  co: CoContact | undefined,
  no: NomeoClient | undefined,
): Blok {
  const punten: Punt[] = [];

  const btwBronnen: BronWaarde[] = [
    { bron: "CRM", waarde: k.vatNumber },
    { bron: "Nomeo", waarde: no?.vat_number || null },
    { bron: "CoManage", waarde: co?.vat_number || null },
  ].filter((b): b is BronWaarde => !!b.waarde);
  const btwUniek = new Set(btwBronnen.map((b) => normaliseerBtw(b.waarde) ?? b.waarde));
  const btwElders = btwBronnen.find((b) => b.bron !== "CRM");

  if (btwUniek.size > 1) {
    punten.push({
      sleutel: "geg:btw-conflict",
      titel: "Btw-nummer verschilt per bron",
      uitleg: [
        ...btwBronnen.map((b) => `${b.bron}: ${b.waarde}`),
        "Uitklaren welke juist is en de andere bron rechtzetten.",
      ],
      toon: "bad",
      open: true,
    });
  }
  punten.push(
    k.vatNumber
      ? { sleutel: "geg:btw", titel: "Btw-nummer", bijschrift: k.vatNumber, uitleg: ["Ingevuld in het CRM."], toon: "info", open: false }
      : {
          sleutel: "geg:btw",
          titel: "Btw-nummer ontbreekt in het CRM",
          uitleg: btwElders
            ? [`Staat wel in ${btwElders.bron}: ${btwElders.waarde} — overnemen in het CRM.`]
            : ["Nergens gekend. Opvragen bij de klant, of afhandelen als het een particulier of vereniging zonder btw-plicht is."],
          toon: btwElders ? "warn" : "bad",
          open: true,
        },
  );

  const coAdres = coAdresVan(co);
  if (k.adres && coAdres && normAdres(k.adres) !== normAdres(coAdres)) {
    punten.push({
      sleutel: "geg:adres-conflict",
      titel: "Facturatieadres verschilt per bron",
      uitleg: [`CRM: ${k.adres}`, `CoManage: ${coAdres}`, "Uitklaren welke juist is."],
      toon: "bad",
      open: true,
    });
  }
  punten.push(
    k.adres
      ? { sleutel: "geg:adres", titel: "Facturatieadres", bijschrift: k.adres, uitleg: ["Ingevuld in het CRM."], toon: "info", open: false }
      : {
          sleutel: "geg:adres",
          titel: "Facturatieadres ontbreekt in het CRM",
          uitleg: coAdres
            ? [`Staat wel in CoManage: ${coAdres} — overnemen in het CRM.`]
            : ["Nergens gekend — opvragen bij de klant."],
          toon: coAdres ? "warn" : "bad",
          open: true,
        },
  );

  const metMail = k.contacten.filter((c) => c.email);
  punten.push(
    metMail.length
      ? {
          sleutel: "geg:contact",
          titel: "Contactpersoon voor facturatie",
          uitleg: metMail.map((c) => `${c.naam} · ${c.email}`),
          toon: "info",
          open: false,
        }
      : {
          sleutel: "geg:contact",
          titel: k.contacten.length
            ? "Contactpersoon zonder e-mailadres"
            : "Geen contactpersoon in het CRM",
          uitleg: k.contacten.length
            ? [...k.contacten.map((c) => `${c.naam} — geen e-mailadres`), "Zonder e-mailadres kan de factuur niet verstuurd worden."]
            : ["Naam en e-mailadres opvragen — anders kan de factuur niet verstuurd worden."],
          toon: "bad",
          open: true,
        },
  );

  if (PUBLIEK.test(k.naam) || k.leverancierStatus !== "nvt") {
    const klaar = k.leverancierStatus === "geregistreerd";
    punten.push({
      sleutel: "geg:leverancier",
      titel: `Leveranciersregistratie: ${k.leverancierStatus}`,
      uitleg: klaar
        ? ["Geregistreerd — de factuur kan door."]
        : [
            "Overheden en scholen betalen vaak pas na registratie als leverancier.",
            "Nakijken of het hier nodig is en de status op de klantfiche zetten. Is het niet nodig, handel dit punt dan af.",
          ],
      toon: klaar ? "info" : "warn",
      open: !klaar,
    });
  }

  return { id: "gegevens", titel: "Facturatiegegevens — hebben wij alles?", punten };
}

function comanageBlok(k: KlantVol): Blok {
  return {
    id: "comanage",
    titel: "CoManage",
    punten: [
      k.comanageId
        ? {
            sleutel: "cm",
            titel: "Klant staat in CoManage",
            bijschrift: `klantnummer ${k.comanageId}`,
            uitleg: ["Gekoppeld — je kan de factuur opmaken."],
            toon: "info",
            open: false,
          }
        : {
            sleutel: "cm",
            titel: "Klant staat nog niet in CoManage",
            uitleg: [
              "Eerst handmatig aanmaken in CoManage, dan het klantnummer op de klantfiche invullen.",
              "Het CRM schrijft bewust nooit naar CoManage.",
            ],
            toon: "bad",
            open: true,
          },
    ],
  };
}

function factuurBlok(
  momenten: MomentRij[],
  domeinen: DomeinRij[],
  siteNamen: Set<string>,
): Blok {
  const punten: Punt[] = [];

  for (const m of momenten) {
    const betreft = m.abonnement.omschrijving ?? "zonder omschrijving";
    const gefactureerd = m.status !== "te_doen";
    punten.push({
      sleutel: `fact:${m.id}`,
      titel: betreft,
      bijschrift: siteNamen.has(betreft) ? "hosting + domein" : "domein",
      uitleg: gefactureerd
        ? [`Staat op ${m.status}.`]
        : [`Factureren vanaf ${dm(m.actieDatum)} · vervalt ${dm(m.abonnement.renewalDate)}.`],
      toon: "info",
      open: !gefactureerd,
      momentId: m.id,
    });
  }

  const gecheckt = domeinen.filter((d) => d.laatsteLiveCheck != null);
  for (const d of gecheckt) {
    const heeftSite = siteNamen.has(d.naam);
    if (d.registratieStatus === "AVAILABLE") {
      punten.push({
        sleutel: `tech:vervallen:${d.naam}`,
        titel: d.naam,
        bijschrift: "vervallen",
        uitleg: ["Domein is vervallen en weer vrij te registreren — niet factureren, of opnieuw vastleggen."],
        toon: "bad",
        open: true,
      });
    }
    if (d.opOnzeServer === false && heeftSite) {
      punten.push({
        sleutel: `tech:elders:${d.naam}`,
        titel: d.naam,
        bijschrift: "hosting elders",
        uitleg: [`De site draait niet op onze Plesk (http ${d.httpStatus ?? "onbekend"}) maar wij rekenen wel hosting aan.`],
        toon: "bad",
        open: true,
      });
    }
    if (d.opOnzeServer === true && !heeftSite) {
      punten.push({
        sleutel: `tech:zondersite:${d.naam}`,
        titel: d.naam,
        bijschrift: "niet gefactureerd",
        uitleg: [`Draait wél op onze Plesk (http ${d.httpStatus ?? "onbekend"}) maar er staat geen site in het CRM — wij factureren hier mogelijk hosting te weinig.`],
        toon: "warn",
        open: true,
      });
    }
    if (d.opOnzeServer === true && d.httpStatus != null && d.httpStatus !== "200") {
      punten.push({
        sleutel: `tech:kapot:${d.naam}`,
        titel: d.naam,
        bijschrift: `http ${d.httpStatus}`,
        uitleg: ["Site staat bij ons maar geeft een fout — herstellen vóór je hosting aanrekent."],
        toon: "warn",
        open: true,
      });
    }
  }

  return { id: "factuur", titel: "Te factureren", punten };
}

export function bouwDossiers(inv: Invoer): Dossier[] {
  const coOp = new Map((inv.coContacts ?? []).map((c) => [String(c.number), c]));
  const nomeoOp = new Map((inv.nomeoKlanten ?? []).map((c) => [c.id, c]));

  const domPerKlant = new Map<string, DomeinRij[]>();
  for (const d of inv.domeinen) {
    if (!d.klantId) continue;
    const lijst = domPerKlant.get(d.klantId) ?? [];
    lijst.push(d);
    domPerKlant.set(d.klantId, lijst);
  }

  const momPerKlant = new Map<string, MomentRij[]>();
  for (const m of inv.momenten) {
    if (!isEigenFacturatie(m.abonnement.renewalDate)) continue;
    const lijst = momPerKlant.get(m.abonnement.klantId) ?? [];
    lijst.push(m);
    momPerKlant.set(m.abonnement.klantId, lijst);
  }

  const dossiers = inv.klanten.map((k): Dossier => {
    const domeinen = (domPerKlant.get(k.id) ?? []).sort((a, b) => a.naam.localeCompare(b.naam));
    const momenten = (momPerKlant.get(k.id) ?? []).sort(
      (a, b) => a.actieDatum.getTime() - b.actieDatum.getTime(),
    );
    return {
      id: k.id,
      naam: k.naam,
      type: k.type,
      comanageId: k.comanageId,
      nomeoId: k.nomeoId,
      notities: k.notities,
      aantalDomeinen: domeinen.length,
      aantalSites: inv.sitesPerKlant.get(k.id) ?? 0,
      blokken: [
        nomeoBlok(domeinen, inv.vandaag),
        gegevensBlok(k, coOp.get(k.comanageId ?? ""), nomeoOp.get(k.nomeoId ?? "")),
        comanageBlok(k),
        factuurBlok(momenten, domeinen, inv.siteNamen),
      ],
    };
  });

  // Meeste openstaande punten eerst — daar valt de meeste winst te halen.
  const open = (d: Dossier) => d.blokken.reduce((t, b) => t + b.punten.filter((p) => p.open).length, 0);
  return dossiers.sort((a, b) => open(b) - open(a) || a.naam.localeCompare(b.naam, "nl"));
}

/** Alleen dit wordt bewaard: wat het CRM niet uit de eigen data kan afleiden. */
export type Afhandeling = { reden: string; door: string; op: string };
export type Stand = {
  afgehandeld: Record<string, Afhandeling>;
  bevindingen: string;
  afgewerkt: { door: string; op: string } | null;
};

export const legeStand = (): Stand => ({ afgehandeld: {}, bevindingen: "", afgewerkt: null });

export function leesStand(value: string | null | undefined): Stand {
  if (!value) return legeStand();
  try {
    const v = JSON.parse(value) as Partial<Stand>;
    return {
      afgehandeld: v.afgehandeld ?? {},
      bevindingen: v.bevindingen ?? "",
      afgewerkt: v.afgewerkt ?? null,
    };
  } catch {
    return legeStand();
  }
}
