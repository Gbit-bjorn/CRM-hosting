@AGENTS.md

# G-Bit Hosting CRM — projectgids voor Claude

Interne mini-CRM + facturatie-radar voor G-Bit (hostingbeheer). Gebruikers: Bjorn, Gill, Jarn.
**Lees `docs/HANDOFF.md` voor de volledige stand van zaken, achtergrond en de refinement-backlog.**

- **Live:** https://crm-hosting.vercel.app (auto-deploy bij elke push naar `main`)
- **Repo:** GitHub `Gbit-bjorn/CRM-hosting` (privé) · lokaal: `C:\Hosting\hosting-crm`
- **Login: Microsoft-only in productie** (Entra ID, allowlist bjorn/gill/jarn@g-bit.be).
  Wachtwoord-login bestaat enkel nog in lokale dev (`ADMIN_EMAIL`/`ADMIN_PASSWORD` in `.env.local`).

## Stack (allemaal nieuwe majors — let op breaking changes)
Next.js 16 (App Router, Turbopack) · React 19 · Prisma 7 · PostgreSQL (Neon, **gedeeld dev+prod**) ·
Auth.js v5 · Tailwind v4 · Inter (next/font) · lucide-react · Vitest.

### Kritische gotchas
- **Next 16:** `middleware` heet nu `proxy.ts`. Wij vermijden dat: auth-gate via `requireAuth()` in `src/lib/auth-guard.ts`, aangeroepen in `src/app/(app)/layout.tsx`. `params`/`searchParams` zijn **async** (Promise).
- **Prisma 7:** generator = `prisma-client` met `output = "../src/generated/prisma"` (git-ignored, wordt door `prisma generate` in de build aangemaakt). Importeer `PrismaClient` uit dat pad (zie `src/lib/db.ts`, met `@prisma/adapter-pg`). CLI-config in `prisma.config.ts` (laadt `.env.local` via dotenv). `migrate` draait **niet** automatisch `generate`.
- **Tailwind v4:** kleuren als tokens in `src/app/globals.css` (`@theme`). **GEEN inline CSS** (`style={...}`) — enkel utility-classes. Klasse-strings moeten letterlijk in de source staan (JIT-scan).
- Voor je Next-code schrijft: lees de docs in `node_modules/next/dist/docs/` (zie AGENTS.md).

## Huisstijl (mag NIET "AI-gemaakt" ogen)
Echte G-Bit-kleuren uit g-bit.be: **charcoal `#32373c`** + **coral `#e6635d`** accent (tokens heten `charcoal`/`coral`).
Neutrale grijsschaal als basis, coral spaarzaam. Semantische status = groen/amber/rood (nooit coral voor betekenis).
**Vermijd:** paars/indigo, gradients, `rounded-2xl`, grote schaduwen, emoji, marketing-copy. Dichte tabellen,
sticky headers, rechts-uitgelijnde tabulaire cijfers (`.tnum`), dot+label status. Basis: `docs/HANDOFF.md` §Design.

## Datamodel & pipeline
Modellen: `Klant, Contact, Site, Domein, Abonnement, FactuurMoment` + klantdossier
`Project, ProjectNotitie, Account` (zie `prisma/schema.prisma` en `docs/superpowers/specs/2026-07-10-projecten-design.md`).
- **Projecten** = naslagwerk per klant (notities/meetingverslagen/accounts), géén taakbeheer.
  `Account.wachtwoord` staat als tekst in de DB (bewuste keuze Bjorn 2026-07-10); de UI verbergt
  het (klik-om-te-tonen) en **het rapport-script geeft wachtwoorden nooit uit**.
- **Eigen velden** (notities, prijzen, factuurstatus, klant-toewijzingen) worden **nooit** door de Nomeo-sync overschreven.
- `Site` heeft `factuurKlant` (wie betaalt) + `eindKlant` (wie zit erachter).
- Data-opbouw = 3 stappen: **seed** (`prisma/seed.ts`, uit `data/plesk-domains.json`) → **sync** (`prisma/sync-once.ts`, Nomeo, versmelt op domein) → **enrich** (`prisma/enrich.ts`: sites uit subscriptions, Bianca reseller, tarieven).
  Volledige herbouw = alles wissen + die 3 opnieuw (zie HANDOFF).

## Bedrijfsregels
- **Factureren 45 dagen (1,5 maand) vóór de vervaldatum** (`actieDatum` in `src/lib/billing.ts`) — Nomeo rekent G-Bit daarvóór al aan.
- **Facturatie pas vanaf feb 2026**; verlengingen vóór maart 2026 waren voor edu-tech → verborgen op de radar (`isEigenFacturatie`).
- **Tarieven (excl. btw):** hosting €90 standaard / €72 reseller · domein .be/.nl/.eu €15, .com €19 (`src/lib/pricing.ts`).
- **Bianca Schoonjans (vabiz)** = enige reseller, maar **niet alles reselled ze**: soms doet ze enkel beheer → dan is de eindklant de factuurklant en staat Bianca als `Site.beheerKlant`. Haar 7 hosting-domeinen + 3 domein-only (`magischminitheaterabra.be`, `nicktails.be`, `saltandsweetbakery.be` — **nog te verifiëren of echt van haar**).
- **Gemeente-/overheidsklanten:** eerst leveranciersregistratie vóór facturatie → `Klant.leverancierStatus` (nvt/vereist/aangevraagd/geregistreerd); radar waarschuwt bij vereist/aangevraagd.
- Een domein/site **verplaatsen** neemt domein + hosting-site + abonnement samen mee (zie `src/lib/mutations.ts`).

## Commando's (in `hosting-crm/`)
```
npm run dev            # dev-server (poort 3000)
npm test               # Vitest (6 tests: billing, nomeo, sync)
npm run build          # prisma generate && next build (productie)
npm run db:seed        # seed uit data/*.json
npm run db:enrich      # sites + Bianca + tarieven
npm run rapport -- --help     # token-zuinige JSON-rapporten: radar, controle, klanten, klant <naam>, projecten, project <naam>
npx tsx prisma/sync-once.ts   # eenmalige Nomeo-sync vanaf CLI
npx tsx prisma/portal-account.ts <email> <klant>  # reseller-portal-account aanmaken/wachtwoord resetten
npx tsx prisma/check-elementor.ts                 # Elementor(-Pro)-scan → Domein.elementorPro
```

## Reseller-portaal (/portal)
Klantgericht read-only portaal (nu voor Bianca): abonnementen + prijzen + vervaldata +
factuurstatus, sites-in-beheer, Elementor Pro-lijst. **Eigen login, volledig los van de
interne Auth.js-auth** — een portal-sessie (`portal_sessie`-cookie, HMAC via `AUTH_SECRET`)
geeft nooit toegang tot het CRM. Code: `src/app/portal/`, `src/lib/portal-auth.ts` /
`portal-actions.ts` / `portal-wachtwoord.ts` (scrypt). Toont enkel verkoopprijzen en eigen
klantdata — nooit inkoopprijzen of interne notities.

Data-JSON in `data/` (git-ignored) komt uit de Excel-exports in `C:\Hosting\` (converteer met openpyxl; zie HANDOFF).

**Data lezen/analyseren? Gebruik `npm run rapport -- <rapport>`** (kale JSON, zelfde reken-logica
als de app via `src/lib/billing.ts`/`src/lib/controle.ts`) — níét de web-UI via de browser uitlezen
en geen ad-hoc Prisma-one-liners schrijven. Browser alleen voor visuele verificatie van UI-werk.

## CoManage (boekhouding) — STRIKT READ-ONLY
**Er wordt NOOIT naar CoManage geschreven** (geen POST/PATCH/DELETE, geen klanten/facturen aanmaken
via de API) — harde afspraak van Bjorn. Client: `src/lib/comanage.ts` (enkel GET). Key: `COMANAGE_API_KEY`.

## Secrets
In `.env.local` (lokaal, git-ignored) en Vercel env vars. Nomeo = OAuth2 client-credentials (`api.nomeo.com`).
De secrets zijn ooit in chat gedeeld → overweeg rotatie van Nomeo-secret + `AUTH_SECRET` +
Entra-clientgeheim. Productie-login is Microsoft-only (2026-07-10); `ADMIN_*` is uit Vercel verwijderd.
