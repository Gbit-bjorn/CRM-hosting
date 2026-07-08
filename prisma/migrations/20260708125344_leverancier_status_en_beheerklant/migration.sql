-- CreateEnum
CREATE TYPE "LeverancierStatus" AS ENUM ('nvt', 'vereist', 'aangevraagd', 'geregistreerd');

-- AlterTable
ALTER TABLE "Klant" ADD COLUMN     "leverancierStatus" "LeverancierStatus" NOT NULL DEFAULT 'nvt';

-- AlterTable
ALTER TABLE "Site" ADD COLUMN     "beheerKlantId" TEXT;

-- AddForeignKey
ALTER TABLE "Site" ADD CONSTRAINT "Site_beheerKlantId_fkey" FOREIGN KEY ("beheerKlantId") REFERENCES "Klant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
