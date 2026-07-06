import { describe, it, expect } from "vitest";
import { actieDatum, radar } from "@/lib/billing";

describe("actieDatum", () => {
  it("is één maand voor de renewal-datum", () => {
    expect(actieDatum(new Date("2026-08-03")).toISOString().slice(0, 10)).toBe("2026-07-03");
  });
});

describe("radar", () => {
  const vandaag = new Date("2026-07-06");
  const items = [
    { actieDatum: new Date("2026-07-20"), status: "te_doen" }, // deze maand
    { actieDatum: new Date("2026-09-01"), status: "te_doen" }, // binnen 90 dagen
    { actieDatum: new Date("2026-07-25"), status: "betaald" }, // weglaten (betaald)
    { actieDatum: new Date("2027-01-01"), status: "te_doen" }, // buiten 90 dagen
  ];

  it("plaatst items van deze kalendermaand in dezeMaand (betaalde weggefilterd)", () => {
    const r = radar(vandaag, items);
    expect(r.dezeMaand).toHaveLength(1);
    expect(r.dezeMaand[0].actieDatum.toISOString().slice(0, 10)).toBe("2026-07-20");
  });

  it("plaatst enkel items binnen 90 dagen én buiten deze maand in komende90", () => {
    const r = radar(vandaag, items);
    expect(r.komende90).toHaveLength(1);
    expect(r.komende90[0].actieDatum.toISOString().slice(0, 10)).toBe("2026-09-01");
  });
});
