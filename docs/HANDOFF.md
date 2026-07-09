# G-Bit Hosting CRM — Handover (volledige stand van zaken)

_Laatst bijgewerkt: 2026-07-08. Voor snelle operationele regels: zie `../CLAUDE.md`._

## 1. Wat is dit

Een **interne mini-CRM + facturatie-radar** voor G-Bit, dat de overgenomen hostingklanten (van Casper/EDU-TECH)
beheert. Draait op een eigen database, verrijkt met live data uit de **Nomeo**-API (domeinen/vervaldatums).
Doel: in één oogopslag zien **wie welke hosting/domeinen afneemt** en **wanneer te factureren** (± 1 maand
vóór G-Bit zelf bij Nomeo betaalt). Gebruikers: **Bjorn, Gill, Jarn** (intern, 3 personen).

- **Live:** https://crm-hosting.vercel.app · **Repo:** GitHub `Gbit-bjorn/CRM-hosting` (privé) · **Lokaal:** `C:\Hosting\hosting-crm`
- **Login:** admin-fallback `bjorn@g-bit.be` + wachtwoord uit `.env.local`/Vercel (lokaal was `miniemen123`).
- **Spec & plan:** `C:\Hosting\docs\superpowers\specs\2026-07-06-hosting-crm-facturatie-radar-design.md` en
  `...\plans\2026-07-06-hosting-crm-facturatie-radar.md`.

## 2. Architectuur

- **Next.js 16** App Router (Turbopack), **React 19**, **TypeScript**.
- **Prisma 7** + **PostgreSQL op Neon**. ⚠️ Dezelfde Neon-DB voor **dev én prod** (gedeeld). Aparte prod-DB = backlog.
  - Generator `prisma-client` → `src/generated/prisma` (git-ignored; `prisma generate` in de build).
  - `src/lib/db.ts` = singleton met `@prisma/adapter-pg` (leest `DATABASE_URL`).
  - `prisma.config.ts` = CLI-config, laadt `.env.local` via dotenv.
- **Auth.js v5** (`src/auth.ts`): Credentials-provider (hardcoded admin uit env) + Microsoft Entra ID
  (alleen actief als `AUTH_MICROSOFT_ENTRA_ID_ID` gezet is — nu leeg). Bescherming via `requireAuth()` in de
  `(app)`-route-group-layout (géén middleware/proxy).
- **Tailwind v4** (tokens in `src/app/globals.css`), **Inter** (next/font), **lucide-react** iconen.
- **Deploy:** Vercel, gekoppeld aan de GitHub-repo. Elke push naar `main` → auto-deploy. Env vars staan in Vercel.

### Belangrijkste mappen/bestanden
```
src/app/(app)/            # beschermde pagina's: page.tsx (radar), klanten, domeinen, sites (+ [id] details)
src/app/login/            # login
src/app/api/{auth,sync,factuur}/
src/components/            # Sidebar, KlantenView, DomeinenView, SyncButton, FactuurKnop, ui/*
src/lib/                   # db, nomeo, sync, billing, pricing, auth-guard, actions, mutations
prisma/                   # schema, seed.ts, enrich.ts, sync-once.ts
data/                     # plesk-domains.json e.a. (git-ignored) — bron voor seed
```

## 3. Datamodel

`Klant` (naam, type direct/reseller/intern, vatNumber, adres, notities, **leverancierStatus** nvt/vereist/aangevraagd/geregistreerd, comanageId?, nomeoId?) ·
`Contact` (→ Klant) · `Site` (naam, pleskStatus, verbruikMB, hostingprijs, **factuurKlant**, **eindKlant?**, **beheerKlant?** = wie beheert als dat niet de factuurklant is, bv. Bianca beheer-only) ·
`Domein` (naam, tld, expireDate, registrationDate, autoRenew, status, inkoopPrijs, verkoopPrijs, nomeoId?, klant?, site?) ·
`Abonnement` (jaarbedrag, renewalDate, omschrijving = domeinnaam, → Klant) ·
`FactuurMoment` (actieDatum = renewalDate − 45 dagen, bedrag, status te_doen/gefactureerd/betaald, → Abonnement).

**Provenance:** velden uit Nomeo (expireDate, autoRenew, status, inkoopPrijs, nomeoId) worden door de sync ge-upsert;
**eigen velden** (notities, verkoopPrijs, hostingprijs, factuurstatus, klant-toewijzingen) blijven onaangeroerd.

## 4. Datapijplijn (seed → sync → enrich)

1. **seed** (`npm run db:seed` → `prisma/seed.ts`): leest `data/plesk-domains.json`, maakt Klant per Plesk-"Customer",
   Domein, Abonnement (€ default) + FactuurMoment.
2. **sync** (`npx tsx prisma/sync-once.ts` → `src/lib/sync.ts`): haalt Nomeo-klanten+domeinen, **versmelt op domein**
   (attacheert Nomeo-identiteit aan de bestaande klant van dat domein → géén dubbels), upsert externe velden.
3. **enrich** (`npm run db:enrich` → `prisma/enrich.ts`): maakt Sites uit `data/plesk-subscriptions.json`
   (= domeinen mét hosting), markeert **Bianca** als reseller + verplaatst/consolideert haar domeinen, zet tarieven,
   herberekent abonnementen/factuurmomenten, ruimt lege klanten op.

**Volledige herbouw** (bij een schone reset):
```
# 1) wissen
node --import tsx -e "import {config} from 'dotenv';config({path:'.env.local'});(async()=>{const{db}=await import('./src/lib/db.ts');await db.factuurMoment.deleteMany();await db.abonnement.deleteMany();await db.site.deleteMany();await db.domein.deleteMany();await db.contact.deleteMany();await db.klant.deleteMany();process.exit(0)})()"
# 2) opbouwen
npx prisma db seed && npx tsx prisma/sync-once.ts && npx tsx prisma/enrich.ts
```
De `data/*.json` worden uit de Excel-exports in `C:\Hosting\` gegenereerd met openpyxl (zie `prisma/seed.ts`
kop-commentaar / de conversie in de git-historie). Bronbestanden: `C:\Hosting\communicatie\hosting klanten.xlsx`
(tabs Domains + Subscriptions) en `C:\Hosting\sales order.xlsx`.

## 5. Bedrijfsregels

- **Factureren 45 dagen (1,5 maand) vóór de vervaldatum** (`actieDatum`/`LEAD_DAGEN` in `src/lib/billing.ts`):
  Nomeo rekent G-Bit daarvóór al aan, dus onze factuur moet eerst buiten zijn. Eenmalige herberekening van
  bestaande momenten: `npx tsx prisma/herbereken-actiedatums.ts` (idempotent).
- **Facturatie start feb 2026**. Verlengingen met renewalDate vóór **maart 2026** waren voor **edu-tech** →
  uit de radar gefilterd via `isEigenFacturatie()` (bewust op renewalDate, niet actieDatum, zodat de grens
  niet mee verschuift met de lead-time).
- **Tarieven, allemaal EXCL. btw** (`src/lib/pricing.ts`): hosting €90 (standaard) / €72 (reseller, −20%);
  domein .be/.nl/.eu €15, .com €19. Afgeleid uit `C:\Hosting\communicatie\mail-bianca-prijsafspraak.md` +
  Nomeo-retailprijzen. Later per site/domein bewerkbaar in de app.
- **Gemeente-/overheidsklanten:** daar moet G-Bit eerst als **leverancier geregistreerd** worden vóór er
  gefactureerd kan worden. Per klant bij te houden via `Klant.leverancierStatus` (nvt/vereist/aangevraagd/
  geregistreerd, bewerkbaar op de klantpagina); de radar toont een amber waarschuwing bij vereist/aangevraagd.
- **Bianca reselled niet alles:** voor sommige sites doet ze **enkel het beheer** — dan is de eindklant zelf de
  factuurklant (€90 i.p.v. reseller-tarief) en zet je Bianca als `Site.beheerKlant` (bewerkbaar op de
  sitepagina; zichtbaar als "Sites in beheer" op haar klantpagina). Welke sites dat zijn: door Bjorn per site
  in te stellen.
- **Reseller:** enkel **Bianca Schoonjans (vabiz)**. Jij factureert aan haar; zij verrekent met haar eindklanten.
  Zij heeft nu 10 domeinen: 7 hosting (academiedevonk, bartspanhove, phinicka, rvenergy, tophatevents, tuineneron,
  vabiz) + 3 domein-only (`magischminitheaterabra.be`, `nicktails.be`, `saltandsweetbakery.be`) die via naam-matching
  bij haar zijn gekomen — **te verifiëren of die 3 echt van haar zijn**.
- **Facturatie-radar:** KPI's (deze maand / **"te laat te factureren"** — bewust niet "achterstallig", dat
  las als "klant heeft niet betaald" / komende 90 dagen) + lijsten met vervaldatum en prijsuitsplitsing
  (hosting + domeindeel); "markeer gefactureerd" zet de status. **"Te laat — totaal per klant"** groepeert
  per klant (één factuur per klant volstaat). Mobiel tonen alle lijsten kaartjes i.p.v. tabellen.
  actieDatum = renewalDate − 45 dagen. Laatste Nomeo-sync-tijdstip staat in `Instelling`
  (key `laatsteSyncNomeo`, gezet door `syncNomeo()`), zichtbaar naast de sync-knop.
- **Domeinstatus:** een verstreken vervaldatum met auto-renew AAN toont "verlengt automatisch" (neutraal),
  niet rood "verlopen" — 17 domeinen (o.a. de KOW-scholen) zitten níét in het Nomeo-portfolio en hebben
  dus mogelijk verouderde Plesk-datums. **Openstaande vraag: waar zijn die geregistreerd?**

## 6. Nomeo-API

OAuth2 client-credentials, base `https://api.nomeo.com` (`src/lib/nomeo.ts`). `POST /auth/token` → Bearer JWT.
`GET /clients` en `GET /domains/list` geven `{ success, message, data: [...] }` (let op: uitpakken via `.data`).
Domein-velden: `domain, client_id, expire_date, registration_date, auto_renew, status, price` (price komt als string).
API-key aangevraagd bij support@nomeo.be.

## 6b. CoManage-API (facturatie)

**⚠️ STRIKT READ-ONLY (afspraak Bjorn 2026-07-08): er wordt NOOIT naar CoManage geschreven** —
geen POST/PATCH/DELETE, geen klanten of facturen aanmaken via de API. CoManage is de boekhouding;
wij lezen er enkel uit. De client biedt bewust alleen GET-functies aan.

Base `https://api.comanage.me/v1`, auth = vaste API-key als Bearer (`COMANAGE_API_KEY` in `.env.local`;
key beheren op app.comanage.me → instellingen → integraties). Docs: https://docs.comanage.me/ (Postman).
Client: `src/lib/comanage.ts` (read-only: contacts/customers/invoices, gepagineerd via `?page=&limit=`).
Let op: records heten `number` (niet `id`); `/contacts` bevat óók leveranciers → filter op `customer: true`;
facturen hebben `status` draft/pending/paid en `totals.total_ex_vat`.
- Gekoppelde klanten tonen op hun detailpagina een **read-only paneel "Facturatiegegevens (CoManage)"**
  (naam, klantnummer, e-mail, telefoon, btw, facturatieadres — live via `getContact()`).
- **Controle-pagina (`/controle`):** vergelijkt CRM ↔ CoManage (btw, adres) per gekoppelde klant en
  valideert btw-nummers via **VIES** (`src/lib/vies.ts`, officiële EU-API, gestreamd via Suspense).
  **Bewust geen auto-overwrite** (nog geen single source of truth): per verschil een expliciete
  "Neem over in CRM"-knop (`neemOverInCrm`). "Niet btw-actief" is een warn, geen fout — vzw's/scholen
  zijn vaak niet btw-plichtig. Klanten zonder btw krijgen KBO- en Peppol-directory-zoeklinks.
- `prisma/comanage-check.ts` — verkenning + match-rapport (read-only).
- `prisma/comanage-koppel.ts` — vult `Klant.comanageId` (btw-match → naam-tokens → handmatige mapping;
  bij dubbele CoManage-contacten wint het contact met de meeste facturen). Gedraaid op 2026-07-08:
  **15 klanten gekoppeld**; 27 CRM-klanten bestaan (nog) niet in CoManage — die maakt Bjorn zelf
  handmatig aan in CoManage (nooit via de API, zie read-only-afspraak hierboven).

## 7. Bekende data-kwesties

- Bron (Plesk-export + Nomeo) bevat **mismatches**: bv. vabiz.be/phinicka.be stonden fout op "VZW 3012WP"
  (gecorrigeerd door Bianca's domeinen naar haar te verplaatsen). Verwacht meer van dit soort.
- Na dedup ± **42 klanten** (was 77 door dubbele import-bronnen).
- De 3 domein-only Bianca-domeinen (zie §5).
- **Eindklanten** achter Bianca's sites zijn nu niet als apart kaartje zichtbaar (enkel het domein). Backlog.

## 8. Wat is af (v1, taken 1–14 uit het plan)

Scaffold, datamodel, Nomeo-client + sync, facturatie-logica, seed, auth (admin + Entra-fallback), UI (sidebar,
radar, klanten kaart/lijst met zoek/filter/sorteer, domeinen, sites), detailpagina's **bewerkbaar** (klant, prijzen,
klant-hertoewijzing, contacten), professioneel G-Bit-redesign, dedup, facturatie-cutoff, **live op Vercel**.
Tests: 5 (billing, nomeo, sync) — `npm test`.

## 8b. Sessie 2026-07-08/09 — wat er bijkwam

- **Mobiel volledig bruikbaar**: sticky topnav met tabs; alle lijsten tonen op mobiel kaartjes i.p.v. tabellen.
- **Rijen overal volledig klikbaar** (stretched-link patroon `tbl.rowLink`, `tr` is relative).
- **Verplaatsen in twee richtingen**: `VerplaatsKnop` (domein of site) op Domeinen-pagina (incl. "Per klant"-
  groepeerweergave) én op de klantpagina. Acties: `verplaatsDomein` / `verplaatsSite` in mutations.ts.
- **Bronvergelijking op de klantpagina** (`BronVergelijking.tsx`): CRM · Nomeo · CoManage per veld met
  status gelijk/verschilt/1 bron + per-bron overneem-knoppen (btw, adres).
- **Controle-pagina** (zie §6b): KPI's, conflicten, aan te vullen, niet-in-CoManage (gesorteerd op
  openstaand bedrag), domeinen buiten Nomeo, VIES, zonder-btw.
- **Bekende bronconflicten** (beslissing Bjorn nodig): Mertens Dylan (Nomeo-btw is oude eenmanszaak,
  CoManage heeft actieve BV) · EDU-TECH (CRM/Nomeo-btw is per abuis dat van G-Bit zélf!) ·
  Miniemeninstituut (instituut vs. scholenkoepel — welke entiteit factureren?).
- **Vercel CLI is ingelogd** op deze machine; project gelinkt (`.vercel/`). `COMANAGE_API_KEY` staat in
  **Production** en is **geverifieerd werkend** (2026-07-09): de Controle-pagina toont live CoManage-data
  (3 btw-conflicten, 19 aan te vullen). De eerste toevoeging via een PowerShell-pipe leverde een kapotte
  waarde op → key opnieuw gezet via `printf '%s' | vercel env add` (Git Bash, geen trailing newline).
  De `.catch`-blokken op de Controle-pagina loggen nu via `console.error` naar de Vercel function-logs
  i.p.v. fouten stil in te slikken.

- **`npm run rapport -- <radar|controle|klanten|klant naam>`** (`scripts/rapport.ts`): token-zuinige
  JSON-rapporten voor AI-analyse en scripts. De bronvergelijking is daarvoor geëxtraheerd naar
  `src/lib/controle.ts` (gedeeld met de Controle-pagina → gegarandeerd dezelfde cijfers).
  Afspraak: AI-sessies lezen data via dit script, niet via de web-UI (zie CLAUDE.md).

- **Technische situatie (sessie 2026-07-09):** `npm run live-check` (DNS/HTTP/whois per domein → velden op
  Domein: liveIp/liveWaar/opOnzeServer/httpStatus/cms/registratieStatus) en `npm run nomeo-contacten`
  (domeincontacten registrant/on-site/admin als JSON op Domein). Controle-pagina toont daaruit: vervallen
  domeinen (5: fonsdrinks + 4 apokring — schrap facturatie), betaalt-hosting-maar-draait-elders (3),
  draait-bij-ons-zonder-facturatie (12, o.a. gelateriagiuditta), kapot (wijzervzw.be = 500), en
  **49/52 domeinen met EDU-TECH/Casper als Nomeo-contact**. Domeinpagina: site-link + live-paneel +
  contactenpaneel. ⚠️ Server-IP gecorrigeerd: Plesk = **185.179.91.206** (+ .174); 62.213.218.239 =
  spamfilter-node. De "buiten Nomeo"-domeinen blijken grotendeels bij Nomeo te zitten onder een ander
  account (vermoedelijk Caspers oude) — overzetten via Nomeo-support.

## 9. Refinement-backlog (volgende sessie)

1. **Bianca opkuisen** — de 3 domein-only verifiëren/verplaatsen (kan nu via de UI: Domein → klant kiezen → Bewaren).
2. **Eindklanten zichtbaar** maken op reseller-sites.
3. **Contacten** per klant importeren (nu grotendeels leeg).
4. **Persoonlijke logins** voor Gill & Jarn via Microsoft 365 / Entra ID (vul `AUTH_MICROSOFT_ENTRA_ID_*` in Vercel +
   `.env.local`; allowlist staat al in `src/auth.ts`).
5. **Comanage-koppeling** + reconciliatie-rapport (mismatches Plesk ↔ Nomeo ↔ Comanage).
6. **Automatische sync** (dagelijkse cron) i.p.v. de knop.
7. **Aparte productie-database** (nu gedeeld dev+prod).
8. **Security:** sterker `ADMIN_PASSWORD` in Vercel; overweeg rotatie Nomeo-secret + `AUTH_SECRET`.

## 10. Werkafspraken (van de gebruiker)

Nederlands. "Simpel en werkend" boven elegant/complex. Legt graag uit waarom (wil bijleren). Werkt iteratief:
klein bouwen → in de browser bekijken → bijsturen. **Geen inline CSS.** De UI mag **niet AI-gemaakt** ogen
(zie designregels in `CLAUDE.md` en de research: understated B2B, echte G-Bit-kleuren).
