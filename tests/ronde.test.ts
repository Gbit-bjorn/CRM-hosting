import { describe, it, expect } from "vitest";
import { bouwDossiers, leesStand, legeStand, type Invoer, type KlantVol } from "@/lib/ronde";

const klant = (over: Partial<KlantVol> = {}): KlantVol => ({
  id: "k1",
  naam: "Testklant BV",
  type: "direct",
  vatNumber: "BE0123456789",
  adres: "Teststraat 1, 3000 Leuven",
  comanageId: "42",
  nomeoId: "999",
  notities: null,
  leverancierStatus: "nvt",
  contacten: [{ naam: "Jan", email: "jan@test.be" }],
  ...over,
});

const invoer = (over: Partial<Invoer> = {}): Invoer => ({
  vandaag: new Date("2026-09-09"),
  klanten: [klant()],
  domeinen: [],
  momenten: [],
  siteNamen: new Set(),
  sitesPerKlant: new Map(),
  coContacts: null,
  nomeoKlanten: null,
  ...over,
});

const punt = (inv: Invoer, blok: string, sleutel: string) =>
  bouwDossiers(inv)[0].blokken.find((b) => b.id === blok)!.punten.find((p) => p.sleutel === sleutel);

describe("facturatiegegevens", () => {
  it("een volledig ingevulde klant heeft geen open gegevenspunten", () => {
    const blok = bouwDossiers(invoer())[0].blokken.find((b) => b.id === "gegevens")!;
    expect(blok.punten.filter((p) => p.open)).toHaveLength(0);
  });

  it("een ontbrekend btw-nummer blijft zichtbaar en staat open", () => {
    const p = punt(invoer({ klanten: [klant({ vatNumber: null })] }), "gegevens", "geg:btw");
    expect(p?.open).toBe(true);
    expect(p?.toon).toBe("bad");
  });

  it("een contactpersoon zonder e-mailadres blokkeert de factuur", () => {
    const p = punt(
      invoer({ klanten: [klant({ contacten: [{ naam: "Jan", email: null }] })] }),
      "gegevens",
      "geg:contact",
    );
    expect(p?.open).toBe(true);
  });

  it("scholen krijgen een punt over leveranciersregistratie, gewone bedrijven niet", () => {
    const school = punt(invoer({ klanten: [klant({ naam: "Basisschool De Vlinder" })] }), "gegevens", "geg:leverancier");
    expect(school?.open).toBe(true);
    expect(punt(invoer(), "gegevens", "geg:leverancier")).toBeUndefined();
  });
});

describe("CoManage", () => {
  it("een klant zonder comanageId staat open, mét id is opgelost", () => {
    expect(punt(invoer({ klanten: [klant({ comanageId: null })] }), "comanage", "cm")?.open).toBe(true);
    expect(punt(invoer(), "comanage", "cm")?.open).toBe(false);
  });
});

describe("Nomeo", () => {
  const domein = {
    id: "d1",
    naam: "test.be",
    klantId: "k1",
    expireDate: new Date("2027-01-01"),
    status: "Active",
    autoRenew: true,
    nomeoId: "n1",
    nomeoContacts: null,
    notities: null,
    opOnzeServer: null,
    httpStatus: null,
    registratieStatus: null,
    laatsteLiveCheck: null,
  };

  it("een gezond domein blijft in de lijst staan maar is niet open", () => {
    const p = punt(invoer({ domeinen: [domein] }), "nomeo", "nomeo:test.be");
    expect(p?.open).toBe(false);
  });

  it("een verstreken vervaldatum met status Active staat open", () => {
    const p = punt(
      invoer({ domeinen: [{ ...domein, expireDate: new Date("2026-08-01") }] }),
      "nomeo",
      "nomeo:test.be",
    );
    expect(p?.open).toBe(true);
  });

  it("een domeincontact dat nog op EDU-TECH staat wordt opgemerkt", () => {
    const p = punt(
      invoer({ domeinen: [{ ...domein, nomeoContacts: [{ organisation: "EDU-TECH BV" }] }] }),
      "nomeo",
      "nomeo:test.be",
    );
    expect(p?.open).toBe(true);
  });
});

describe("te factureren", () => {
  const moment = {
    id: "m1",
    actieDatum: new Date("2026-08-01"),
    status: "te_doen",
    abonnement: { klantId: "k1", omschrijving: "test.be", renewalDate: new Date("2026-09-15") },
  };

  it("een openstaand moment staat open, een gefactureerd moment blijft zichtbaar maar niet open", () => {
    expect(punt(invoer({ momenten: [moment] }), "factuur", "fact:m1")?.open).toBe(true);
    expect(
      punt(invoer({ momenten: [{ ...moment, status: "gefactureerd" }] }), "factuur", "fact:m1")?.open,
    ).toBe(false);
  });

  it("verlengingen van vóór maart 2026 zijn edu-tech en horen er niet in", () => {
    const oud = { ...moment, abonnement: { ...moment.abonnement, renewalDate: new Date("2026-02-01") } };
    expect(punt(invoer({ momenten: [oud] }), "factuur", "fact:m1")).toBeUndefined();
  });

  it("hosting elders terwijl wij hosting aanrekenen wordt gemeld", () => {
    const inv = invoer({
      domeinen: [
        {
          id: "d1",
          naam: "test.be",
          klantId: "k1",
          expireDate: new Date("2027-01-01"),
          status: "Active",
          autoRenew: true,
          nomeoId: "n1",
          nomeoContacts: null,
          notities: null,
          opOnzeServer: false,
          httpStatus: "200",
          registratieStatus: null,
          laatsteLiveCheck: new Date("2026-09-08"),
        },
      ],
      siteNamen: new Set(["test.be"]),
    });
    expect(punt(inv, "factuur", "tech:elders:test.be")?.open).toBe(true);
  });
});

describe("leesStand", () => {
  it("geeft een lege stand bij ontbrekende of kapotte JSON", () => {
    expect(leesStand(null)).toEqual(legeStand());
    expect(leesStand("{kapot")).toEqual(legeStand());
  });

  it("leest een bewaarde afhandeling terug", () => {
    const s = leesStand(
      JSON.stringify({ afgehandeld: { "geg:btw": { reden: "particulier", door: "gill@g-bit.be", op: "2026-09-09T10:00:00Z" } } }),
    );
    expect(s.afgehandeld["geg:btw"].door).toBe("gill@g-bit.be");
    expect(s.bevindingen).toBe("");
  });
});
