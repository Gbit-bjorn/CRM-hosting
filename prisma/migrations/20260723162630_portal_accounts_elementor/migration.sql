-- AlterTable
ALTER TABLE "Domein" ADD COLUMN     "elementorPro" BOOLEAN;

-- CreateTable
CREATE TABLE "PortalAccount" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "wachtwoordHash" TEXT NOT NULL,
    "actief" BOOLEAN NOT NULL DEFAULT true,
    "laatsteLogin" TIMESTAMP(3),
    "klantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortalAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PortalAccount_email_key" ON "PortalAccount"("email");

-- AddForeignKey
ALTER TABLE "PortalAccount" ADD CONSTRAINT "PortalAccount_klantId_fkey" FOREIGN KEY ("klantId") REFERENCES "Klant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
