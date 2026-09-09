import { auth } from "@/auth";
import { db } from "@/lib/db";
import { eigenSleutel, leesStand, rondeSleutel, type BlokId, type PuntStand, type Stand } from "@/lib/ronde";

type Body =
  | { actie: "afhandelen"; klantId: string; sleutel: string; reden: string }
  | { actie: "betwisten"; klantId: string; sleutel: string; reden: string }
  | { actie: "heropenen"; klantId: string; sleutel: string }
  | { actie: "opmerking"; klantId: string; sleutel: string; tekst: string }
  | { actie: "eigen-toevoegen"; klantId: string; id: string; blok: BlokId; titel: string }
  | { actie: "eigen-verwijderen"; klantId: string; id: string }
  | { actie: "bevindingen"; klantId: string; tekst: string }
  | { actie: "afgewerkt"; klantId: string; aan: boolean }
  | { actie: "factuur"; klantId: string; momentId: string; gefactureerd: boolean }
  | { actie: "comanage-id"; klantId: string; comanageId: string };

async function bewaar(klantId: string, wijzig: (s: Stand) => Stand) {
  const key = rondeSleutel(klantId);
  const rij = await db.instelling.findUnique({ where: { key } });
  const value = JSON.stringify(wijzig(leesStand(rij?.value)));
  await db.instelling.upsert({ where: { key }, create: { key, value }, update: { value } });
}

/** Past één punt aan; een leeg resultaat verdwijnt uit de map. */
function zetPunt(s: Stand, sleutel: string, wijzig: (p: PuntStand) => PuntStand): Stand {
  const nieuw = wijzig(s.punten[sleutel] ?? {});
  const punten = { ...s.punten };
  if (Object.keys(nieuw).length === 0) delete punten[sleutel];
  else punten[sleutel] = nieuw;
  return { ...s, punten };
}

export async function POST(req: Request) {
  const session = await auth();
  const door = session?.user?.email;
  if (!door) return Response.json({ error: "niet aangemeld" }, { status: 401 });

  const body = (await req.json()) as Body;
  const op = new Date().toISOString();

  switch (body.actie) {
    case "afhandelen":
      await bewaar(body.klantId, (s) =>
        zetPunt(s, body.sleutel, (p) => {
          const { betwist: _weg, ...rest } = p;
          return { ...rest, afgehandeld: { reden: body.reden, door, op } };
        }),
      );
      break;

    case "betwisten":
      await bewaar(body.klantId, (s) =>
        zetPunt(s, body.sleutel, (p) => {
          const { afgehandeld: _weg, ...rest } = p;
          return { ...rest, betwist: { reden: body.reden, door, op } };
        }),
      );
      break;

    case "heropenen":
      await bewaar(body.klantId, (s) =>
        zetPunt(s, body.sleutel, ({ afgehandeld: _a, betwist: _b, ...rest }) => rest),
      );
      break;

    case "opmerking":
      await bewaar(body.klantId, (s) =>
        zetPunt(s, body.sleutel, ({ opmerking: _o, ...rest }) =>
          body.tekst.trim() ? { ...rest, opmerking: { tekst: body.tekst, door, op } } : rest,
        ),
      );
      break;

    case "eigen-toevoegen":
      await bewaar(body.klantId, (s) => ({
        ...s,
        eigen: [...s.eigen, { id: body.id, blok: body.blok, titel: body.titel, door, op }],
      }));
      break;

    case "eigen-verwijderen":
      await bewaar(body.klantId, (s) => {
        const punten = { ...s.punten };
        delete punten[eigenSleutel(body.id)];
        return { ...s, punten, eigen: s.eigen.filter((e) => e.id !== body.id) };
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
      await bewaar(body.klantId, (s) =>
        zetPunt(s, `fact:${body.momentId}`, ({ afgehandeld: _a, ...rest }) =>
          body.gefactureerd ? { ...rest, afgehandeld: { reden: "gefactureerd", door, op } } : rest,
        ),
      );
      break;

    case "comanage-id": {
      const nummer = body.comanageId.trim();
      await db.klant.update({
        where: { id: body.klantId },
        data: { comanageId: nummer || null },
      });
      break;
    }

    default:
      return Response.json({ error: "onbekende actie" }, { status: 400 });
  }

  return Response.json({ ok: true, door, op });
}
