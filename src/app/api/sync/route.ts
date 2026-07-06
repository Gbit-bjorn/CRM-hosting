import { syncNomeo } from "@/lib/sync";

export async function POST() {
  try {
    const result = await syncNomeo();
    return Response.json(result);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
