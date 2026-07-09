-- AlterTable
ALTER TABLE "Domein" ADD COLUMN     "cms" TEXT,
ADD COLUMN     "httpStatus" TEXT,
ADD COLUMN     "laatsteLiveCheck" TIMESTAMP(3),
ADD COLUMN     "liveIp" TEXT,
ADD COLUMN     "liveWaar" TEXT,
ADD COLUMN     "nomeoCancelled" BOOLEAN,
ADD COLUMN     "nomeoContacts" JSONB,
ADD COLUMN     "nomeoContactsCheck" TIMESTAMP(3),
ADD COLUMN     "nomeoExpired" BOOLEAN,
ADD COLUMN     "opOnzeServer" BOOLEAN,
ADD COLUMN     "registratieStatus" TEXT;
