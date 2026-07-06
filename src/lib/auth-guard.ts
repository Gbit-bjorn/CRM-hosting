import { redirect } from "next/navigation";
import { auth } from "@/auth";

/** Roep bovenaan elke beschermde server-pagina aan. Stuurt naar /login zonder sessie. */
export async function requireAuth() {
  const session = await auth();
  if (!session) redirect("/login");
  return session;
}
