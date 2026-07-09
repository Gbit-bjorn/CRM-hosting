// Token-zuinige data-rapporten (kale JSON, geen opmaak) voor analyse door
// AI-agents en scripts. Leest enkel — schrijft nooit iets weg.
// Gebruik: npm run rapport -- --help
import { config } from "dotenv";
config({ path: ".env.local" });
import type { DomeinTech } from "../src/lib/controle";

const HELP = `Gebruik: npm run rapport -- <rapport> [argument]

Rapporten:
  radar             KPI's + open factuurregels (te laat / deze maand / komende 90 dagen)
  controle          bronvergelijking CRM/Nomeo/CoManage (zonder VIES — die staat op /controle)
  klanten           alle klanten met aantallen en open bedrag
  klant <zoekterm>  detail van één klant (contacten, domeinen, sites, abonnementen)

Output: JSON. Bedragen excl. btw, datums YYYY-MM-DD. Zelfde reken-logica als de web-app
(src/lib/billing.ts en src/lib/controle.ts).`;

const dag = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);
const som = (xs: { bedrag: number }[]) => Math.round(xs.reduce((t, x) => t + x.bedrag, 0));

async function radarRapport() {
  const { db } = await import("../src/lib/db");
  const { radar, isEigenFacturatie } = await import("../src/lib/billing");

  const momenten = await db.factuurMoment.findMany({
    include: {
      abonnement: {
        include: { klant: { select: { naam: true, leverancierStatus: true } } },
      },
    },
    orderBy: { actieDatum: "asc" },
  });
  const eigen = momenten.filter((m) => isEigenFacturatie(m.abonnement.renewalDate));

  const vandaag = new Date();
  const startMaand = new Date(vandaag.getFullYear(), vandaag.getMonth(), 1);
  const open = eigen.map((m) => ({ actieDatum: m.actieDatum, status: m.status, bedrag: m.bedrag, m }));
  const { dezeMaand, komende90 } = radar(vandaag, open);
  const teLaat = open.filter((x) => x.status === "te_doen" && x.actieDatum < startMaand);

  const rij = (x: (typeof open)[0]) => ({
    klant: x.m.abonnement.klant.naam,
    betreft: x.m.abonnement.omschrijving,
    bedrag: x.bedrag,
    actie: dag(x.actieDatum),
    vervalt: dag(x.m.abonnement.renewalDate),
    status: x.status,
    ...(x.m.abonnement.klant.leverancierStatus !== "nvt"
      ? { leverancierStatus: x.m.abonnement.klant.leverancierStatus }
      : {}),
  });

  return {
    kpis: {
      teLaat: { bedrag: som(teLaat), regels: teLaat.length },
      dezeMaand: { bedrag: som(dezeMaand), regels: dezeMaand.length },
      komende90: { bedrag: som(komende90), regels: komende90.length },
    },
    teLaat: teLaat.map(rij),
    dezeMaand: dezeMaand.map(rij),
    komende90: komende90.map(rij),
  };
}

async function controleRapport() {
  const { db } = await import("../src/lib/db");
  const { comanageActief, listContacts } = await import("../src/lib/comanage");
  const { listClients } = await import("../src/lib/nomeo");
  const { vergelijkBronnen, technischeControle } = await import("../src/lib/controle");

  const [klanten, coContacts, nomeoKlanten, openMomenten] = await Promise.all([
    db.klant.findMany({
      orderBy: { naam: "asc" },
      select: {
        id: true,
        naam: true,
        type: true,
        vatNumber: true,
        adres: true,
        comanageId: true,
        nomeoId: true,
      },
    }),
    comanageActief() ? listContacts().catch(() => null) : Promise.resolve(null),
    listClients().catch(() => null),
    db.factuurMoment.findMany({
      where: { status: "te_doen" },
      select: { bedrag: true, abonnement: { select: { klantId: true, renewalDate: true } } },
    }),
  ]);

  const [techDomeinen, siteNamen] = await Promise.all([
    db.domein.findMany({
      select: {
        id: true,
        naam: true,
        opOnzeServer: true,
        liveWaar: true,
        httpStatus: true,
        cms: true,
        registratieStatus: true,
        laatsteLiveCheck: true,
        nomeoContacts: true,
        klant: { select: { id: true, naam: true } },
      },
    }),
    db.site.findMany({ select: { naam: true, hostingprijs: true } }),
  ]);
  const t = technischeControle(techDomeinen, siteNamen);
  const kaal = (d: DomeinTech) => ({
    domein: d.naam,
    klant: d.klant?.naam ?? null,
    ...(d.liveWaar ? { waar: d.liveWaar } : {}),
    ...(d.httpStatus ? { http: d.httpStatus } : {}),
  });

  const r = vergelijkBronnen(klanten, coContacts, nomeoKlanten, openMomenten);
  return {
    technisch: {
      gecheckt: t.gecheckt,
      vervallen: t.vervallen.map(kaal),
      eldersMetHosting: t.eldersMetHosting.map(kaal),
      bijOnsZonderSite: t.bijOnsZonderSite.map(kaal),
      kapotBijOns: t.kapotBijOns.map(kaal),
      verouderdContact: t.verouderdContact.map((d) => d.naam),
    },
    bronnen: {
      coManage: coContacts ? "ok" : "onbereikbaar of geen key",
      nomeo: nomeoKlanten ? "ok" : "onbereikbaar",
    },
    conflicten: r.conflicten.map((c) => ({ klant: c.klant.naam, veld: c.label, waarden: c.waarden })),
    aanTeVullen: r.aanTeVullen.map((a) => ({
      klant: a.klant.naam,
      veld: a.label,
      bron: a.bron,
      waarde: a.waarde,
    })),
    nietInCoManage: r.nietGekoppeld.map((k) => ({
      klant: k.naam,
      openBedrag: Math.round(k.open.bedrag),
      regels: k.open.regels,
    })),
    zonderBtw: r.zonderBtw.map((k) => k.naam),
  };
}

async function klantenRapport() {
  const { db } = await import("../src/lib/db");
  const { isEigenFacturatie } = await import("../src/lib/billing");

  const klanten = await db.klant.findMany({
    orderBy: { naam: "asc" },
    include: {
      _count: { select: { domeinen: true, sites: true, contacten: true } },
      abonnementen: {
        select: {
          renewalDate: true,
          factuurMomenten: { where: { status: "te_doen" }, select: { bedrag: true } },
        },
      },
    },
  });
  return klanten.map((k) => ({
    naam: k.naam,
    type: k.type,
    ...(k.leverancierStatus !== "nvt" ? { leverancierStatus: k.leverancierStatus } : {}),
    inCoManage: !!k.comanageId,
    domeinen: k._count.domeinen,
    sites: k._count.sites,
    contacten: k._count.contacten,
    openBedrag: Math.round(
      k.abonnementen
        .filter((a) => isEigenFacturatie(a.renewalDate))
        .flatMap((a) => a.factuurMomenten)
        .reduce((t, m) => t + m.bedrag, 0),
    ),
  }));
}

async function klantRapport(zoek: string) {
  const { db } = await import("../src/lib/db");

  const k = await db.klant.findFirst({
    where: { naam: { contains: zoek, mode: "insensitive" } },
    include: {
      contacten: true,
      domeinen: { orderBy: { expireDate: "asc" } },
      sites: {
        include: {
          eindKlant: { select: { naam: true } },
          beheerKlant: { select: { naam: true } },
        },
      },
      beheerSites: { select: { naam: true, factuurKlant: { select: { naam: true } } } },
      abonnementen: { include: { factuurMomenten: { orderBy: { actieDatum: "asc" } } } },
    },
  });
  if (!k) return { fout: `Geen klant gevonden voor "${zoek}". Zie het rapport "klanten" voor alle namen.` };

  return {
    naam: k.naam,
    type: k.type,
    vatNumber: k.vatNumber,
    adres: [k.adres, k.postcode, k.stad].filter(Boolean).join(", ") || null,
    leverancierStatus: k.leverancierStatus,
    comanageId: k.comanageId,
    nomeoId: k.nomeoId,
    notities: k.notities,
    contacten: k.contacten.map((c) => ({ naam: c.naam, email: c.email, telefoon: c.telefoon, rol: c.rol })),
    domeinen: k.domeinen.map((d) => ({
      naam: d.naam,
      vervalt: dag(d.expireDate),
      autoRenew: d.autoRenew,
      status: d.status,
      inNomeo: !!d.nomeoId,
      verkoopPrijs: d.verkoopPrijs,
      ...(d.notities ? { notities: d.notities } : {}),
    })),
    sites: k.sites.map((s) => ({
      naam: s.naam,
      pleskStatus: s.pleskStatus,
      hostingprijs: s.hostingprijs,
      ...(s.eindKlant ? { eindKlant: s.eindKlant.naam } : {}),
      ...(s.beheerKlant ? { beheerKlant: s.beheerKlant.naam } : {}),
      ...(s.notities ? { notities: s.notities } : {}),
    })),
    ...(k.beheerSites.length > 0
      ? {
          sitesInBeheer: k.beheerSites.map((s) => ({ naam: s.naam, factuurKlant: s.factuurKlant.naam })),
        }
      : {}),
    abonnementen: k.abonnementen.map((a) => ({
      betreft: a.omschrijving,
      jaarbedrag: a.jaarbedrag,
      vervalt: dag(a.renewalDate),
      momenten: a.factuurMomenten.map((m) => ({ actie: dag(m.actieDatum), bedrag: m.bedrag, status: m.status })),
    })),
  };
}

const [rapport, ...rest] = process.argv.slice(2);

(async () => {
  if (!rapport || rapport === "--help" || rapport === "help") {
    console.log(HELP);
    process.exit(0);
  }
  const uit = (data: unknown) => console.log(JSON.stringify(data));
  switch (rapport) {
    case "radar":
      uit(await radarRapport());
      break;
    case "controle":
      uit(await controleRapport());
      break;
    case "klanten":
      uit(await klantenRapport());
      break;
    case "klant":
      if (rest.length === 0) {
        console.error('Geef een zoekterm mee: npm run rapport -- klant "vabiz"');
        process.exit(2);
      }
      uit(await klantRapport(rest.join(" ")));
      break;
    default:
      console.error(`Onbekend rapport "${rapport}".\n\n${HELP}`);
      process.exit(2);
  }
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
