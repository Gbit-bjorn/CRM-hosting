import { db } from "@/lib/db";

export async function POST(req: Request) {
  const { id, status } = await req.json();
  await db.factuurMoment.update({ where: { id }, data: { status } });
  return Response.json({ ok: true });
}
