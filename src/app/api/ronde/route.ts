import { auth } from "@/auth";
import { db } from "@/lib/db";
import { leesStand, rondeSleutel, type Stand } from "@/lib/ronde";

type Body =
  | { actie: "afhandelen"; klantId: string; sleutel: string; reden: string }
  | { actie: "heropenen"; klantId: string; sleutel: string }
  | { actie: "bevindingen"; klantId: string; tekst: string }
  | { actie: "afgewerkt"; klantId: string; aan: boolean }
  | { actie: "factuur"; klantId: string; momentId: string; gefactureerd: boolean };

async function bewaar(klantId: string, wijzig: (s: Stand) => Stand) {
  const key = rondeSleutel(klantId);
  const rij = await db.instelling.findUnique({ where: { key } });
  const value = JSON.stringify(wijzig(leesStand(rij?.value)));
  await db.instelling.upsert({ where: { key }, create: { key, value }, update: { value } });
}

export async function POST(req: Request) {
  const session = await auth();
  const door = session?.user?.email;
  if (!door) return Response.json({ error: "niet aangemeld" }, { status: 401 });

  const body = (await req.json()) as Body;
  const op = new Date().toISOString();

  switch (body.actie) {
    case "afhandelen":
      await bewaar(body.klantId, (s) => ({
        ...s,
        afgehandeld: { ...s.afgehandeld, [body.sleutel]: { reden: body.reden, door, op } },
      }));
      break;

    case "heropenen":
      await bewaar(body.klantId, (s) => {
        const rest = { ...s.afgehandeld };
        delete rest[body.sleutel];
        return { ...s, afgehandeld: rest };
      });
      break;

    case "bevindingen":
      await bewaar(body.klantId, (s) => ({ ...s, bevindingen: body.tekst }));
      break;

    case "afgewerkt":
      await bewaar(body.klantId, (s) => ({ ...s, afgewerkt: body.aan ? { door, op } : null }));
      break;

    case "factuur":
      await db.factuurMoment.update({
        where: { id: body.momentId },
        data: { status: body.gefactureerd ? "gefactureerd" : "te_doen" },
      });
      // Wie de regel afvinkte staat nergens op FactuurMoment — hou het hier bij.
      await bewaar(body.klantId, (s) => {
        const sleutel = `fact:${body.momentId}`;
        const rest = { ...s.afgehandeld };
        if (body.gefactureerd) rest[sleutel] = { reden: "gefactureerd", door, op };
        else delete rest[sleutel];
        return { ...s, afgehandeld: rest };
      });
      break;

    default:
      return Response.json({ error: "onbekende actie" }, { status: 400 });
  }

  return Response.json({ ok: true, door, op });
}
