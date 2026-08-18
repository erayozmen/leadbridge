CREATE TYPE "AcademyMatchStatus" AS ENUM ('MATCHED', 'NOT_FOUND', 'AMBIGUOUS');
CREATE TYPE "AcademySyncRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED');

CREATE TABLE "AcademyStudentLink" (
  "id" TEXT NOT NULL, "vrRecordId" TEXT NOT NULL, "qrRegistrationId" TEXT NOT NULL,
  "academyStudentId" TEXT, "status" "AcademyMatchStatus" NOT NULL, "matchedAt" TIMESTAMP(3),
  "lastCheckedAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "AcademyStudentLink_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AcademyPaymentSnapshot" (
  "id" TEXT NOT NULL, "vrRecordId" TEXT NOT NULL, "academyStudentId" TEXT NOT NULL,
  "lastObservedPaidAmount" DECIMAL(14,2) NOT NULL, "currency" CHAR(3) NOT NULL, "version" INTEGER NOT NULL DEFAULT 0,
  "lastSyncedAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "AcademyPaymentSnapshot_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AcademySyncRun" (
  "id" TEXT NOT NULL, "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "finishedAt" TIMESTAMP(3),
  "status" "AcademySyncRunStatus" NOT NULL DEFAULT 'RUNNING', "candidateCount" INTEGER NOT NULL DEFAULT 0,
  "matchedCount" INTEGER NOT NULL DEFAULT 0, "notFoundCount" INTEGER NOT NULL DEFAULT 0,
  "ambiguousCount" INTEGER NOT NULL DEFAULT 0, "commissionAdjustmentCount" INTEGER NOT NULL DEFAULT 0,
  "errorCount" INTEGER NOT NULL DEFAULT 0, CONSTRAINT "AcademySyncRun_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AcademyCommissionLedger" (
  "id" TEXT NOT NULL, "vrRecordId" TEXT NOT NULL, "academyStudentId" TEXT NOT NULL,
  "academyPaymentDelta" DECIMAL(14,2) NOT NULL, "commissionRate" DECIMAL(7,4) NOT NULL,
  "commissionAmount" DECIMAL(14,2) NOT NULL, "academyTotalPaidAfter" DECIMAL(14,2) NOT NULL,
  "currency" CHAR(3) NOT NULL, "snapshotVersion" INTEGER NOT NULL, "syncRunId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "AcademyCommissionLedger_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AcademyStudentLink_vrRecordId_key" ON "AcademyStudentLink"("vrRecordId");
CREATE INDEX "AcademyStudentLink_status_lastCheckedAt_idx" ON "AcademyStudentLink"("status", "lastCheckedAt");
CREATE INDEX "AcademyStudentLink_academyStudentId_idx" ON "AcademyStudentLink"("academyStudentId");
CREATE UNIQUE INDEX "AcademyPaymentSnapshot_vrRecordId_key" ON "AcademyPaymentSnapshot"("vrRecordId");
CREATE INDEX "AcademyPaymentSnapshot_academyStudentId_idx" ON "AcademyPaymentSnapshot"("academyStudentId");
CREATE UNIQUE INDEX "AcademyCommissionLedger_vrRecordId_snapshotVersion_key" ON "AcademyCommissionLedger"("vrRecordId", "snapshotVersion");
CREATE INDEX "AcademyCommissionLedger_syncRunId_idx" ON "AcademyCommissionLedger"("syncRunId");
CREATE INDEX "AcademyCommissionLedger_academyStudentId_createdAt_idx" ON "AcademyCommissionLedger"("academyStudentId", "createdAt");
CREATE INDEX "AcademySyncRun_startedAt_idx" ON "AcademySyncRun"("startedAt");
CREATE INDEX "AcademySyncRun_status_startedAt_idx" ON "AcademySyncRun"("status", "startedAt");
ALTER TABLE "AcademyStudentLink" ADD CONSTRAINT "AcademyStudentLink_vrRecordId_fkey" FOREIGN KEY ("vrRecordId") REFERENCES "VrRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AcademyStudentLink" ADD CONSTRAINT "AcademyStudentLink_qrRegistrationId_fkey" FOREIGN KEY ("qrRegistrationId") REFERENCES "QrRegistration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AcademyPaymentSnapshot" ADD CONSTRAINT "AcademyPaymentSnapshot_vrRecordId_fkey" FOREIGN KEY ("vrRecordId") REFERENCES "VrRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AcademyCommissionLedger" ADD CONSTRAINT "AcademyCommissionLedger_vrRecordId_fkey" FOREIGN KEY ("vrRecordId") REFERENCES "VrRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AcademyCommissionLedger" ADD CONSTRAINT "AcademyCommissionLedger_syncRunId_fkey" FOREIGN KEY ("syncRunId") REFERENCES "AcademySyncRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AcademyStudentLink" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AcademyPaymentSnapshot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AcademyCommissionLedger" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AcademySyncRun" ENABLE ROW LEVEL SECURITY;
