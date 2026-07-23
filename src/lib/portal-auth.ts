// Auth voor het reseller-portaal (/portal) — bewust volledig gescheiden van de
// interne Auth.js-login: een portal-sessie geeft nooit toegang tot het CRM.
// Wachtwoorden: scrypt (node:crypto, geen extra dependency), opgeslagen als
// "salt:hash". Sessie: HMAC-getekende cookie op basis van AUTH_SECRET.
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

export { hashWachtwoord, verifieerWachtwoord } from "@/lib/portal-wachtwoord";

const COOKIE_NAAM = "portal_sessie";
const SESSIE_DAGEN = 30;

function geheim(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET ontbreekt — nodig voor portal-sessies");
  return s;
}

function onderteken(payload: string): string {
  return createHmac("sha256", geheim()).update(payload).digest("base64url");
}

// Token: "<accountId>.<verloopt-ms>.<handtekening>"
function maakToken(accountId: string): string {
  const payload = `${accountId}.${Date.now() + SESSIE_DAGEN * 24 * 60 * 60 * 1000}`;
  return `${payload}.${onderteken(payload)}`;
}

function leesToken(token: string): string | null {
  const delen = token.split(".");
  if (delen.length !== 3) return null;
  const payload = `${delen[0]}.${delen[1]}`;
  const a = Buffer.from(delen[2]);
  const b = Buffer.from(onderteken(payload));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (Number(delen[1]) < Date.now()) return null;
  return delen[0];
}

export async function zetPortalSessie(accountId: string) {
  (await cookies()).set(COOKIE_NAAM, maakToken(accountId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/portal",
    maxAge: SESSIE_DAGEN * 24 * 60 * 60,
  });
}

export async function wisPortalSessie() {
  // Leegmaken met maxAge 0 — delete() vereist een exact pad-match, dit is robuuster.
  (await cookies()).set(COOKIE_NAAM, "", { path: "/portal", maxAge: 0 });
}

/** Ingelogd portal-account + klant, of null. */
export async function portalAccount() {
  const token = (await cookies()).get(COOKIE_NAAM)?.value;
  if (!token) return null;
  const accountId = leesToken(token);
  if (!accountId) return null;
  const account = await db.portalAccount.findUnique({
    where: { id: accountId },
    include: { klant: { select: { id: true, naam: true } } },
  });
  return account?.actief ? account : null;
}

/** Voor portal-pagina's: redirect naar de portal-login zonder sessie. */
export async function vereisPortalAccount() {
  const account = await portalAccount();
  if (!account) redirect("/portal/login");
  return account;
}
