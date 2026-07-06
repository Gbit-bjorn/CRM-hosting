import { describe, it, expect, vi, beforeEach } from "vitest";
import { listDomains } from "@/lib/nomeo";

beforeEach(() => {
  process.env.NOMEO_BASE_URL = "https://api.nomeo.com";
  process.env.NOMEO_CLIENT_ID = "cid";
  process.env.NOMEO_CLIENT_SECRET = "secret";
});

describe("listDomains", () => {
  it("haalt een token op en gebruikt dat als bearer voor de domeinen-call", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "jwt123" }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          message: "Domain list",
          data: [
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
          ],
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const domains = await listDomains();
    expect(domains[0].domain).toBe("example.be");
    expect(fetchMock.mock.calls[0][0]).toContain("/auth/token");
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe("Bearer jwt123");
  });
});
