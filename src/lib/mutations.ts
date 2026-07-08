"use server";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

function tekst(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : s;
}
function getal(fd: FormData, key: string): number | null {
  const s = tekst(fd, key);
  if (s == null) return null;
  const n = Number(s.replace(",", "."));
  return isNaN(n) ? null : n;
}

export async function updateKlant(id: string, fd: FormData) {
  await db.klant.update({
    where: { id },
    data: {
      naam: tekst(fd, "naam") ?? "Onbekend",
      type: (tekst(fd, "type") ?? "direct") as "direct" | "reseller" | "intern",
      vatNumber: tekst(fd, "vatNumber"),
      adres: tekst(fd, "adres"),
      notities: tekst(fd, "notities"),
      leverancierStatus: (tekst(fd, "leverancierStatus") ?? "nvt") as
        | "nvt"
        | "vereist"
        | "aangevraagd"
        | "geregistreerd",
    },
  });
  revalidatePath(`/klanten/${id}`);
  revalidatePath("/klanten");
}

export async function addContact(klantId: string, fd: FormData) {
  const naam = tekst(fd, "naam");
  if (!naam) return;
  await db.contact.create({
    data: { klantId, naam, email: tekst(fd, "email"), telefoon: tekst(fd, "telefoon"), rol: tekst(fd, "rol") },
  });
  revalidatePath(`/klanten/${klantId}`);
}

export async function deleteContact(id: string, klantId: string) {
  await db.contact.delete({ where: { id } });
  revalidatePath(`/klanten/${klantId}`);
}

export async function updateDomein(id: string, fd: FormData) {
  const klantId = tekst(fd, "klantId");
  const d = await db.domein.update({
    where: { id },
    data: { verkoopPrijs: getal(fd, "verkoopPrijs"), klantId },
  });
  // Facturatie én hosting volgen de klant van het domein mee.
  if (klantId) {
    await db.abonnement.updateMany({ where: { omschrijving: d.naam }, data: { klantId } });
    await db.site.updateMany({ where: { naam: d.naam }, data: { factuurKlantId: klantId } });
  }
  revalidatePath(`/domeinen/${id}`);
  revalidatePath("/domeinen");
  revalidatePath("/klanten");
  revalidatePath("/");
}

/**
 * Neem één veld expliciet over in het CRM (vanaf de Controle-pagina).
 * Bewust géén automatische overschrijving — de gebruiker beslist per veld.
 * Er wordt nooit iets naar CoManage geschreven.
 */
export async function neemOverInCrm(klantId: string, veld: "vatNumber" | "adres", waarde: string) {
  if (veld !== "vatNumber" && veld !== "adres") return;
  if (!waarde.trim()) return;
  await db.klant.update({ where: { id: klantId }, data: { [veld]: waarde.trim() } });
  revalidatePath("/controle");
  revalidatePath("/klanten");
  revalidatePath(`/klanten/${klantId}`);
}

/** Verplaats een domein naar een andere klant; abonnement en hosting-site verhuizen mee. */
export async function verplaatsDomein(id: string, klantId: string) {
  if (!klantId) return;
  const d = await db.domein.update({ where: { id }, data: { klantId } });
  await db.abonnement.updateMany({ where: { omschrijving: d.naam }, data: { klantId } });
  await db.site.updateMany({ where: { naam: d.naam }, data: { factuurKlantId: klantId } });
  revalidatePath("/domeinen");
  revalidatePath("/klanten");
  revalidatePath("/sites");
  revalidatePath("/");
}

/** Verplaats een site naar een andere factuurklant; abonnement en gelijknamig domein verhuizen mee. */
export async function verplaatsSite(id: string, klantId: string) {
  if (!klantId) return;
  const s = await db.site.update({ where: { id }, data: { factuurKlantId: klantId } });
  await db.abonnement.updateMany({ where: { omschrijving: s.naam }, data: { klantId } });
  await db.domein.updateMany({ where: { naam: s.naam }, data: { klantId } });
  revalidatePath("/domeinen");
  revalidatePath("/klanten");
  revalidatePath("/sites");
  revalidatePath("/");
}

export async function updateSite(id: string, fd: FormData) {
  const factuurKlantId = tekst(fd, "factuurKlantId");
  const s = await db.site.update({
    where: { id },
    data: {
      hostingprijs: getal(fd, "hostingprijs"),
      factuurKlantId: factuurKlantId ?? undefined,
      eindKlantId: tekst(fd, "eindKlantId"),
      beheerKlantId: tekst(fd, "beheerKlantId"),
    },
  });
  // Het abonnement voor deze site volgt de factuurklant mee.
  if (factuurKlantId) {
    await db.abonnement.updateMany({ where: { omschrijving: s.naam }, data: { klantId: factuurKlantId } });
  }
  revalidatePath(`/sites/${id}`);
  revalidatePath("/sites");
  revalidatePath("/klanten");
  revalidatePath("/");
}
