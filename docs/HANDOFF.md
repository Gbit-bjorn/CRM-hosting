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
- **Facturatie-radar:** KPI's (deze maand / achterstallig / komende 90 dagen) + lijsten (met vervaldatum);
  "markeer gefactureerd" zet de status. Extra: **"Achterstallig per klant"** groepeert alle openstaande posten
  sinds februari per klant (één factuur per klant). actieDatum = renewalDate − 45 dagen.

## 6. Nomeo-API

OAuth2 client-credentials, base `https://api.nomeo.com` (`src/lib/nomeo.ts`). `POST /auth/token` → Bearer JWT.
`GET /clients` en `GET /domains/list` geven `{ success, message, data: [...] }` (let op: uitpakken via `.data`).
Domein-velden: `domain, client_id, expire_date, registration_date, auto_renew, status, price` (price komt als string).
API-key aangevraagd bij support@nomeo.be. Er is óók een Comanage-API (facturatie) — nog niet gekoppeld.

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
