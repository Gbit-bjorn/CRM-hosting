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
  await db.domein.update({
    where: { id },
    data: {
      verkoopPrijs: getal(fd, "verkoopPrijs"),
      klantId: tekst(fd, "klantId"),
    },
  });
  revalidatePath(`/domeinen/${id}`);
  revalidatePath("/domeinen");
  revalidatePath("/klanten");
}

export async function updateSite(id: string, fd: FormData) {
  await db.site.update({
    where: { id },
    data: {
      hostingprijs: getal(fd, "hostingprijs"),
      factuurKlantId: tekst(fd, "factuurKlantId") ?? undefined,
      eindKlantId: tekst(fd, "eindKlantId"),
    },
  });
  revalidatePath(`/sites/${id}`);
  revalidatePath("/sites");
  revalidatePath("/klanten");
}
