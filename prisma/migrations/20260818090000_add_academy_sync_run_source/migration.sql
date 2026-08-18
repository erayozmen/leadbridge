CREATE TYPE "AcademySyncRunSource" AS ENUM ('CRON', 'MANUAL');

ALTER TABLE "AcademySyncRun"
ADD COLUMN "source" "AcademySyncRunSource" NOT NULL DEFAULT 'CRON';
