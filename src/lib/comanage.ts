// CoManage-API (facturatiepakket van G-Bit). Docs: https://docs.comanage.me/
// Auth: vaste API-key als Bearer-token (aanmaken in CoManage →
// instellingen → integraties: https://app.comanage.me/settings/general/integrations).
//
// ⚠️ AFSPRAAK (Bjorn, 2026-07-08): deze integratie is STRIKT READ-ONLY.
// CoManage is de boekhouding — er wordt NOOIT naar geschreven (geen POST/PATCH/
// DELETE). Voeg hier geen write-functies toe; `authedGet` staat bewust vast op GET.
const BASE = "https://api.comanage.me/v1";

export const comanageActief = () => !!process.env.COMANAGE_API_KEY;

// CoManage identificeert records met `number` (niet `id`). We typeren enkel
// wat we gebruiken en laten de rest open zodat verkenning niets wegfiltert.
export type CoContact = {
  number: number;
  name?: string | null;
  customer?: boolean;
  supplier?: boolean;
  customer_number?: string | null;
  vat_number?: string | null;
  email?: string | null;
  trashed?: boolean;
  [key: string]: unknown;
};

export type CoInvoice = {
  number: number;
  invoice_number?: string | null;
  title?: string | null;
  status?: string | null; // draft | pending | paid | ...
  date?: string | null;
  due_date?: string | null;
  totals?: { total_ex_vat?: number; total?: number; total_due?: number };
  contact?: CoContact | null;
  trashed?: boolean;
  [key: string]: unknown;
};

async function authedGet<T>(path: string): Promise<T> {
  const key = process.env.COMANAGE_API_KEY;
  if (!key) throw new Error("COMANAGE_API_KEY ontbreekt in .env.local");
  const res = await fetch(`${BASE}${path}`, {
    method: "GET", // read-only afspraak — nooit een andere methode gebruiken
    headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`CoManage GET ${path} faalde: ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

// Lijsten zijn gepagineerd (Laravel-stijl): { data: [...], meta: { ... } }.
async function getAll<T>(path: string): Promise<T[]> {
  const alles: T[] = [];
  for (let page = 1; page <= 50; page++) {
    const sep = path.includes("?") ? "&" : "?";
    const json = await authedGet<{ data?: T[] } | T[]>(`${path}${sep}page=${page}&limit=100`);
    const items = Array.isArray(json) ? json : (json.data ?? []);
    alles.push(...items);
    if (items.length < 100) break;
  }
  return alles;
}

export const listContacts = () => getAll<CoContact>("/contacts");
export const listCustomers = () => getAll<CoContact>("/customers");
export const listInvoices = () => getAll<CoInvoice>("/invoices");
