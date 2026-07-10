"use server";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

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
function datumVeld(fd: FormData, key: string): Date | null {
  const s = tekst(fd, key);
  if (s == null) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
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

/** Nieuwe klant aanmaken. Bestaat de naam al → door naar die bestaande klant. */
export async function maakKlant(fd: FormData) {
  const naam = tekst(fd, "naam");
  if (!naam) return;
  const bestaand = await db.klant.findUnique({ where: { naam } });
  const k =
    bestaand ??
    (await db.klant.create({
      data: {
        naam,
        type: (tekst(fd, "type") ?? "direct") as "direct" | "reseller" | "intern",
        vatNumber: tekst(fd, "vatNumber"),
        adres: tekst(fd, "adres"),
      },
    }));
  revalidatePath("/klanten");
  redirect(`/klanten/${k.id}`);
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
    data: { verkoopPrijs: getal(fd, "verkoopPrijs"), klantId, notities: tekst(fd, "notities") },
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

/**
 * Schrap de facturatie van een vervallen domein: abonnement + factuurmomenten weg.
 * Enkel via de expliciete knop op de Controle-pagina (beslissing van de gebruiker);
 * het domein-record zelf blijft bestaan als naslag.
 */
export async function schrapFacturatie(domeinNaam: string) {
  const abo = await db.abonnement.findFirst({ where: { omschrijving: domeinNaam } });
  if (!abo) return;
  await db.factuurMoment.deleteMany({ where: { abonnementId: abo.id } });
  await db.abonnement.delete({ where: { id: abo.id } });
  revalidatePath("/controle");
  revalidatePath("/");
  revalidatePath("/klanten");
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

/* ── Projecten (klantdossier) ─────────────────────────────────────────── */

type ProjectStatus = "gepland" | "actief" | "gepauzeerd" | "afgerond";
const projectStatus = (fd: FormData): ProjectStatus => {
  const s = tekst(fd, "status");
  return s === "gepland" || s === "gepauzeerd" || s === "afgerond" ? s : "actief";
};

export async function maakProject(klantId: string, fd: FormData) {
  const naam = tekst(fd, "naam");
  if (!naam) return;
  const p = await db.project.create({ data: { klantId, naam, omschrijving: tekst(fd, "omschrijving") } });
  revalidatePath(`/klanten/${klantId}`);
  revalidatePath("/projecten");
  redirect(`/projecten/${p.id}`);
}

export async function updateProject(id: string, fd: FormData) {
  await db.project.update({
    where: { id },
    data: {
      naam: tekst(fd, "naam") ?? "Onbekend",
      status: projectStatus(fd),
      omschrijving: tekst(fd, "omschrijving"),
      startDatum: datumVeld(fd, "startDatum"),
      eindDatum: datumVeld(fd, "eindDatum"),
    },
  });
  revalidatePath(`/projecten/${id}`);
  revalidatePath("/projecten");
}

/** Verwijdert project + notities (cascade); accounts blijven bij de klant staan. */
export async function verwijderProject(id: string, klantId: string) {
  await db.project.delete({ where: { id } });
  revalidatePath("/projecten");
  revalidatePath(`/klanten/${klantId}`);
  redirect(`/klanten/${klantId}`);
}

export async function addNotitie(projectId: string, fd: FormData) {
  const titel = tekst(fd, "titel");
  const inhoud = tekst(fd, "inhoud");
  if (!titel || !inhoud) return;
  await db.projectNotitie.create({
    data: {
      projectId,
      type: tekst(fd, "type") === "verslag" ? "verslag" : "notitie",
      titel,
      datum: datumVeld(fd, "datum") ?? new Date(),
      inhoud,
      auteur: tekst(fd, "auteur"),
    },
  });
  revalidatePath(`/projecten/${projectId}`);
}

export async function updateNotitie(id: string, projectId: string, fd: FormData) {
  await db.projectNotitie.update({
    where: { id },
    data: {
      type: tekst(fd, "type") === "verslag" ? "verslag" : "notitie",
      titel: tekst(fd, "titel") ?? "Zonder titel",
      datum: datumVeld(fd, "datum") ?? new Date(),
      inhoud: tekst(fd, "inhoud") ?? "",
      auteur: tekst(fd, "auteur"),
    },
  });
  revalidatePath(`/projecten/${projectId}`);
}

export async function deleteNotitie(id: string, projectId: string) {
  await db.projectNotitie.delete({ where: { id } });
  revalidatePath(`/projecten/${projectId}`);
}

/* ── Accounts (logins van de klant) ───────────────────────────────────── */

export async function addAccount(klantId: string, fd: FormData) {
  const dienst = tekst(fd, "dienst");
  if (!dienst) return;
  await db.account.create({
    data: {
      klantId,
      dienst,
      url: tekst(fd, "url"),
      gebruikersnaam: tekst(fd, "gebruikersnaam"),
      wachtwoord: tekst(fd, "wachtwoord"),
      notitie: tekst(fd, "notitie"),
      projectId: tekst(fd, "projectId"),
    },
  });
  revalidatePath(`/klanten/${klantId}`);
}

export async function updateAccount(id: string, klantId: string, fd: FormData) {
  await db.account.update({
    where: { id },
    data: {
      dienst: tekst(fd, "dienst") ?? "Onbekend",
      url: tekst(fd, "url"),
      gebruikersnaam: tekst(fd, "gebruikersnaam"),
      wachtwoord: tekst(fd, "wachtwoord"),
      notitie: tekst(fd, "notitie"),
      projectId: tekst(fd, "projectId"),
    },
  });
  revalidatePath(`/klanten/${klantId}`);
}

export async function deleteAccount(id: string, klantId: string) {
  await db.account.delete({ where: { id } });
  revalidatePath(`/klanten/${klantId}`);
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
      notities: tekst(fd, "notities"),
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
