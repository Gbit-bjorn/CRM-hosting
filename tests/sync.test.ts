import { describe, it, expect, vi } from "vitest";
import * as nomeo from "@/lib/nomeo";

vi.mock("@/lib/nomeo");

const upsertDomein = vi.fn();
const updateKlant = vi.fn().mockResolvedValue({});
vi.mock("@/lib/db", () => ({
  db: {
    klant: {
      update: (a: unknown) => updateKlant(a),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "knew" }),
    },
    domein: {
      findUnique: vi.fn().mockResolvedValue({ naam: "example.be", klantId: "kbestaand" }),
      upsert: (a: unknown) => upsertDomein(a),
    },
  },
}));

describe("syncNomeo", () => {
  it("versmelt Nomeo in de bestaande klant van het domein en behoudt eigen velden", async () => {
    vi.mocked(nomeo.listClients).mockResolvedValue([
      { id: "9", firstname: "A", lastname: "B", company: "ACME", email: "a@b.be", vat_number: "BE1" },
    ]);
    vi.mocked(nomeo.listDomains).mockResolvedValue([
      {
        id: "1",
        domain: "example.be",
        client_id: "9",
        expire_date: "2026-08-03",
        registration_date: "2021-08-03",
        auto_renew: true,
        status: "Active",
        price: 11.5,
      },
    ]);

    const { syncNomeo } = await import("@/lib/sync");
    const result = await syncNomeo();

    // De bestaande klant kreeg de nomeoId (merge) — er is GEEN nieuwe klant aangemaakt.
    expect(updateKlant).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "kbestaand" },
        data: expect.objectContaining({ nomeoId: "9" }),
      }),
    );
    const arg = upsertDomein.mock.calls[0][0];
    expect(arg.update).not.toHaveProperty("verkoopPrijs");
    expect(arg.update.klantId).toBe("kbestaand");
    expect(arg.update.expireDate).toBeInstanceOf(Date);
    expect(result.domeinen).toBe(1);
  });
});
