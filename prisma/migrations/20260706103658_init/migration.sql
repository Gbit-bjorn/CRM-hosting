-- CreateEnum
CREATE TYPE "KlantType" AS ENUM ('direct', 'reseller', 'intern');

-- CreateEnum
CREATE TYPE "FactuurStatus" AS ENUM ('te_doen', 'gefactureerd', 'betaald');

-- CreateTable
CREATE TABLE "Klant" (
    "id" TEXT NOT NULL,
    "naam" TEXT NOT NULL,
    "type" "KlantType" NOT NULL DEFAULT 'direct',
    "vatNumber" TEXT,
    "adres" TEXT,
    "stad" TEXT,
    "postcode" TEXT,
    "land" TEXT DEFAULT 'Belgium',
    "notities" TEXT,
    "comanageId" TEXT,
    "nomeoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Klant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "naam" TEXT NOT NULL,
    "email" TEXT,
    "telefoon" TEXT,
    "rol" TEXT,
    "klantId" TEXT NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Site" (
    "id" TEXT NOT NULL,
    "naam" TEXT NOT NULL,
    "pleskStatus" TEXT,
    "verbruikMB" DOUBLE PRECISION,
    "hostingprijs" DOUBLE PRECISION,
    "factuurKlantId" TEXT NOT NULL,
    "eindKlantId" TEXT,

    CONSTRAINT "Site_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Domein" (
    "id" TEXT NOT NULL,
    "naam" TEXT NOT NULL,
    "tld" TEXT,
    "expireDate" TIMESTAMP(3),
    "registrationDate" TIMESTAMP(3),
    "autoRenew" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT,
    "inkoopPrijs" DOUBLE PRECISION,
    "verkoopPrijs" DOUBLE PRECISION,
    "nomeoId" TEXT,
    "klantId" TEXT,
    "siteId" TEXT,

    CONSTRAINT "Domein_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Abonnement" (
    "id" TEXT NOT NULL,
    "omschrijving" TEXT,
    "jaarbedrag" DOUBLE PRECISION NOT NULL,
    "renewalDate" TIMESTAMP(3) NOT NULL,
    "klantId" TEXT NOT NULL,

    CONSTRAINT "Abonnement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FactuurMoment" (
    "id" TEXT NOT NULL,
    "actieDatum" TIMESTAMP(3) NOT NULL,
    "bedrag" DOUBLE PRECISION NOT NULL,
    "status" "FactuurStatus" NOT NULL DEFAULT 'te_doen',
    "comanageRef" TEXT,
    "abonnementId" TEXT NOT NULL,

    CONSTRAINT "FactuurMoment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Klant_naam_key" ON "Klant"("naam");

-- CreateIndex
CREATE UNIQUE INDEX "Klant_nomeoId_key" ON "Klant"("nomeoId");

-- CreateIndex
CREATE UNIQUE INDEX "Domein_naam_key" ON "Domein"("naam");

-- CreateIndex
CREATE UNIQUE INDEX "Domein_nomeoId_key" ON "Domein"("nomeoId");

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_klantId_fkey" FOREIGN KEY ("klantId") REFERENCES "Klant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Site" ADD CONSTRAINT "Site_factuurKlantId_fkey" FOREIGN KEY ("factuurKlantId") REFERENCES "Klant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Site" ADD CONSTRAINT "Site_eindKlantId_fkey" FOREIGN KEY ("eindKlantId") REFERENCES "Klant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Domein" ADD CONSTRAINT "Domein_klantId_fkey" FOREIGN KEY ("klantId") REFERENCES "Klant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Domein" ADD CONSTRAINT "Domein_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Abonnement" ADD CONSTRAINT "Abonnement_klantId_fkey" FOREIGN KEY ("klantId") REFERENCES "Klant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactuurMoment" ADD CONSTRAINT "FactuurMoment_abonnementId_fkey" FOREIGN KEY ("abonnementId") REFERENCES "Abonnement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
