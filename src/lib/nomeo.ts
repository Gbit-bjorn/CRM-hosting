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
