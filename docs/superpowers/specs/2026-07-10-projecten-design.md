# Projecten-module — ontwerp (2026-07-10)

Goedgekeurd door Bjorn ("ik vertrouw je, ik oordeel wel visueel") na brainstorm.
Doel: het CRM uitbreiden tot klantdossier — per klant meerdere projecten met
notities, meetingverslagen en accounts/wachtwoorden. Géén taakbeheer.

## Beslissingen uit de brainstorm

- **Doel:** klantdossier (naslagwerk voor Bjorn/Gill/Jarn), geen werkbeheer met taken/deadlines.
- **Wachtwoorden: plaintext** in de database — bewuste keuze van Bjorn (2026-07-10),
  na expliciete waarschuwing (publieke app, gedeelde dev+prod-DB). UI verbergt ze
  standaard (klik-om-te-tonen). Versleuteling kan later toegevoegd worden zonder dataverlies.
- **Invoer: handmatig in de web-UI.** De agent leest uit via het rapport-script.
- **CoManage:** de API biedt géén projecten/taken/timesheets (afgetast 2026-07-10:
  enkel contacts, customers, suppliers, invoices, offers, creditnotes, products).
  Dus geen sync; wel CoManage-facturen/offertes van de klant als read-only context
  op de projectpagina. Read-only-afspraak blijft onverkort gelden.

## Datamodel (additief, bestaande modellen ongewijzigd op relatievelden na)

```prisma
enum ProjectStatus { gepland actief gepauzeerd afgerond }
enum NotitieType   { notitie verslag }

model Project {
  naam, status (default actief), omschrijving?, startDatum?, eindDatum?
  klant Klant (verplicht)  // meerdere projecten per klant
  notities ProjectNotitie[]  accounts Account[]
}

model ProjectNotitie {
  type (notitie|verslag), titel, datum (meetingdatum, niet createdAt),
  inhoud (vrije tekst, regeleinden behouden), auteur?
  project Project (cascade delete)
}

model Account {
  dienst, url?, gebruikersnaam?, wachtwoord?, notitie?
  klant Klant (verplicht)   // logins overleven projecten
  project Project? (optioneel)
}
```

Provenance-regel: de Nomeo-sync en enrich raken deze tabellen nooit aan.

## UI

- **Klantpagina:** secties "Projecten" (compacte lijst: naam, status, laatste activiteit)
  en "Accounts" (wachtwoord verborgen als ••••, toon-knop + kopieerknop).
- **`/projecten`** (zijbalk): overzicht alle projecten, filter op status.
- **`/projecten/[id]`:** dossier — omschrijving, notities/verslagen chronologisch
  (nieuwste eerst), accounts, CoManage-context van de klant.
- Formulieren via server actions in `src/lib/mutations.ts`, huisstijl G-Bit
  (dichte tabellen, geen coral voor betekenis, geen inline CSS).

## Agent-toegang (rapport-script)

- `rapport -- projecten` — overzicht.
- `rapport -- project <zoekterm>` — volledig dossier incl. notitie-inhoud.
- `rapport -- klant <naam>` — toont voortaan ook de projectenlijst.
- **Wachtwoorden nooit in rapport-output** (JSON belandt in agent-/chatcontext):
  enkel dienst + gebruikersnaam, nooit het geheim.

## Bewust niet (YAGNI)

Geen taken/deadlines, geen tijdsregistratie, geen bestandsbijlagen, geen
markdown-rendering (platte tekst met `whitespace-pre-wrap`; opmaak kan later),
geen CoManage-schrijfacties.
