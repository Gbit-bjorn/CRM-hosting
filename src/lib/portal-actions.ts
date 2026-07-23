"use server";
// Server actions voor het reseller-portaal. Los van de interne Auth.js-login.
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { verifieerWachtwoord, zetPortalSessie, wisPortalSessie } from "@/lib/portal-auth";

export async function portalLogin(fd: FormData) {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const wachtwoord = String(fd.get("wachtwoord") ?? "");
  const account = email ? await db.portalAccount.findUnique({ where: { email } }) : null;
  // Vaste kleine vertraging: geen timing-verschil tussen "bestaat niet" en "fout wachtwoord".
  await new Promise((r) => setTimeout(r, 400));
  if (!account?.actief || !verifieerWachtwoord(wachtwoord, account.wachtwoordHash)) {
    redirect("/portal/login?fout=1");
  }
  await db.portalAccount.update({
    where: { id: account.id },
    data: { laatsteLogin: new Date() },
  });
  await zetPortalSessie(account.id);
  redirect("/portal");
}

export async function portalLogout() {
  await wisPortalSessie();
  redirect("/portal/login");
}
