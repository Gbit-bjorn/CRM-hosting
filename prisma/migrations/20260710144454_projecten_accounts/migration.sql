-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('gepland', 'actief', 'gepauzeerd', 'afgerond');

-- CreateEnum
CREATE TYPE "NotitieType" AS ENUM ('notitie', 'verslag');

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "naam" TEXT NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'actief',
    "omschrijving" TEXT,
    "startDatum" TIMESTAMP(3),
    "eindDatum" TIMESTAMP(3),
    "klantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectNotitie" (
    "id" TEXT NOT NULL,
    "type" "NotitieType" NOT NULL DEFAULT 'notitie',
    "titel" TEXT NOT NULL,
    "datum" TIMESTAMP(3) NOT NULL,
    "inhoud" TEXT NOT NULL,
    "auteur" TEXT,
    "projectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectNotitie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "dienst" TEXT NOT NULL,
    "url" TEXT,
    "gebruikersnaam" TEXT,
    "wachtwoord" TEXT,
    "notitie" TEXT,
    "klantId" TEXT NOT NULL,
    "projectId" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_klantId_fkey" FOREIGN KEY ("klantId") REFERENCES "Klant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectNotitie" ADD CONSTRAINT "ProjectNotitie_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_klantId_fkey" FOREIGN KEY ("klantId") REFERENCES "Klant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
