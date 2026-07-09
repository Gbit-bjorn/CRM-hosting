const base = () => process.env.NOMEO_BASE_URL!;

export type NomeoDomain = {
  id: string;
  domain: string;
  client_id: string;
  expire_date: string | null;
  registration_date: string | null;
  auto_renew: boolean;
  status: string;
  price: number | string | null;
  expired?: boolean;
  cancelled_but_not_expired?: boolean;
};

export type NomeoContact = {
  first_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
  email_address?: string | null;
  phone_number?: string | null;
  street?: string | null;
  city?: string | null;
  postal_code?: string | null;
};

/** Detail per domein — bevat o.a. contacts: registrant / on_site (whois) / admin / tech / billing. */
export type NomeoDomainDetail = NomeoDomain & {
  contacts?: Record<string, NomeoContact | null> | null;
};

export type NomeoClient = {
  id: string;
  firstname: string;
  lastname: string;
  company: string;
  email: string;
  vat_number: string;
};

export async function getNomeoToken(): Promise<string> {
  const res = await fetch(`${base()}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.NOMEO_CLIENT_ID,
      client_secret: process.env.NOMEO_CLIENT_SECRET,
      grant_type: "client_credentials",
    }),
  });
  if (!res.ok) throw new Error(`Nomeo auth faalde: ${res.status}`);
  const data = await res.json();
  return data.access_token;
}

async function authedGet<T>(path: string): Promise<T> {
  const token = await getNomeoToken();
  const res = await fetch(`${base()}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Nomeo GET ${path} faalde: ${res.status}`);
  const json = await res.json();
  // Nomeo verpakt lijsten in { success, message, data: [...] }.
  return (json?.data ?? json) as T;
}

export const listDomains = () => authedGet<NomeoDomain[]>("/domains/list");
export const listClients = () => authedGet<NomeoClient[]>("/clients");

/** Domein-detail (met contacten). Geef een token mee bij bulk-gebruik — spaart een auth-call per domein. */
export async function getDomainDetail(naam: string, token?: string): Promise<NomeoDomainDetail> {
  const t = token ?? (await getNomeoToken());
  const res = await fetch(`${base()}/domains/${naam}`, { headers: { Authorization: `Bearer ${t}` } });
  if (!res.ok) throw new Error(`Nomeo GET /domains/${naam} faalde: ${res.status}`);
  const json = await res.json();
  return (json?.data ?? json) as NomeoDomainDetail;
}
