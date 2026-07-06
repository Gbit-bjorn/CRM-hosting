import { describe, it, expect, vi } from "vitest";
import * as nomeo from "@/lib/nomeo";

vi.mock("@/lib/nomeo");

const upsertDomein = vi.fn();
vi.mock("@/lib/db", () => ({
  db: {
    klant: { upsert: vi.fn().mockResolvedValue({ id: "k1", nomeoId: "9" }) },
    domein: { upsert: (a: unknown) => upsertDomein(a) },
  },
}));

describe("syncNomeo", () => {
  it("upsert domeinen enkel op externe velden, laat eigen velden ongemoeid", async () => {
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

    const arg = upsertDomein.mock.calls[0][0];
    expect(arg.update).not.toHaveProperty("verkoopPrijs");
    expect(arg.update.expireDate).toBeInstanceOf(Date);
    expect(arg.update.autoRenew).toBe(true);
    expect(arg.update.klantId).toBe("k1");
    expect(result).toEqual({ domeinen: 1, klanten: 1 });
  });
});
