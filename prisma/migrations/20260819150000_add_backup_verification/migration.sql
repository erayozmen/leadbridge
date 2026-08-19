CREATE TYPE "BackupVerificationType" AS ENUM ('MANAGED_BACKUP', 'LOGICAL_BACKUP', 'RESTORE_REHEARSAL');
CREATE TYPE "BackupVerificationStatus" AS ENUM ('VERIFIED', 'FAILED');
CREATE TYPE "ManagedBackupStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'UNKNOWN');
CREATE TYPE "PitrStatus" AS ENUM ('ENABLED', 'DISABLED', 'UNKNOWN');

CREATE TABLE "BackupVerification" (
  "id" TEXT NOT NULL,
  "type" "BackupVerificationType" NOT NULL,
  "status" "BackupVerificationStatus" NOT NULL,
  "provider" TEXT NOT NULL,
  "verificationMethod" TEXT NOT NULL,
  "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "backupCreatedAt" TIMESTAMP(3),
  "sizeBytes" BIGINT,
  "checksumSha256" TEXT,
  "pgDumpVersion" TEXT,
  "managedStatus" "ManagedBackupStatus",
  "pitrStatus" "PitrStatus",
  "verifiedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BackupVerification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BackupVerification_type_verifiedAt_idx" ON "BackupVerification"("type", "verifiedAt");
CREATE INDEX "BackupVerification_verifiedByUserId_verifiedAt_idx" ON "BackupVerification"("verifiedByUserId", "verifiedAt");
ALTER TABLE "BackupVerification" ADD CONSTRAINT "BackupVerification_verifiedByUserId_fkey" FOREIGN KEY ("verifiedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BackupVerification" ENABLE ROW LEVEL SECURITY;
