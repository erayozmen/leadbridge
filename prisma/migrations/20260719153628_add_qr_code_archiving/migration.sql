-- AlterTable
ALTER TABLE "QrCode" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "QrCode_archivedAt_idx" ON "QrCode"("archivedAt");
