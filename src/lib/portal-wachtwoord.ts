// Wachtwoord-hashing voor portal-accounts: scrypt uit node:crypto (geen extra
// dependency), opgeslagen als "salt:hash". Los bestand zonder Next-imports
// zodat ook CLI-scripts (prisma/portal-account.ts) dit kunnen gebruiken.
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export function hashWachtwoord(wachtwoord: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(wachtwoord, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifieerWachtwoord(wachtwoord: string, opgeslagen: string): boolean {
  const [salt, hash] = opgeslagen.split(":");
  if (!salt || !hash) return false;
  const kandidaat = scryptSync(wachtwoord, salt, 64);
  const juist = Buffer.from(hash, "hex");
  return kandidaat.length === juist.length && timingSafeEqual(kandidaat, juist);
}
