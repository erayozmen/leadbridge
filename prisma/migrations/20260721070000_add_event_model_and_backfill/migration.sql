-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "location" TEXT NOT NULL,
    "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- Expand with nullable columns before backfill
ALTER TABLE "VrRecord" ADD COLUMN "eventId" TEXT;
ALTER TABLE "QrCode" ADD COLUMN "eventId" TEXT;
ALTER TABLE "QrRegistration" ADD COLUMN "eventId" TEXT;

-- The current schema is single-tenant; preserve existing rows under one deterministic event.
INSERT INTO "Event" ("id", "name", "eventDate", "location", "status", "createdAt", "updatedAt")
VALUES ('leadbridge-legacy-event', U&'Ge\00E7mi\015F Kay\0131tlar', TIMESTAMP '1970-01-01 00:00:00', 'Belirtilmedi', 'COMPLETED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

UPDATE "VrRecord" SET "eventId" = 'leadbridge-legacy-event' WHERE "eventId" IS NULL;
UPDATE "QrCode" SET "eventId" = 'leadbridge-legacy-event' WHERE "eventId" IS NULL;
UPDATE "QrRegistration" SET "eventId" = 'leadbridge-legacy-event' WHERE "eventId" IS NULL;

-- Contract after deterministic backfill
ALTER TABLE "VrRecord" ALTER COLUMN "eventId" SET NOT NULL;
ALTER TABLE "QrCode" ALTER COLUMN "eventId" SET NOT NULL;
ALTER TABLE "QrRegistration" ALTER COLUMN "eventId" SET NOT NULL;

CREATE INDEX "Event_status_eventDate_idx" ON "Event"("status", "eventDate");
CREATE INDEX "Event_eventDate_idx" ON "Event"("eventDate");
CREATE INDEX "VrRecord_eventId_createdAt_idx" ON "VrRecord"("eventId", "createdAt");
CREATE INDEX "QrCode_eventId_status_idx" ON "QrCode"("eventId", "status");
CREATE INDEX "QrRegistration_eventId_registeredAt_idx" ON "QrRegistration"("eventId", "registeredAt");

ALTER TABLE "VrRecord" ADD CONSTRAINT "VrRecord_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QrCode" ADD CONSTRAINT "QrCode_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QrRegistration" ADD CONSTRAINT "QrRegistration_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
