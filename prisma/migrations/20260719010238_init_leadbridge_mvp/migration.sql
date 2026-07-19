-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'STAFF');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "QrCodeStatus" AS ENUM ('CREATED', 'ASSIGNED', 'USED', 'DISABLED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "authUserId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'STAFF',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VrRecord" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "school" TEXT NOT NULL,
    "phone" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "assignedQrCodeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VrRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QrCode" (
    "id" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "status" "QrCodeStatus" NOT NULL DEFAULT 'CREATED',
    "assignedAt" TIMESTAMP(3),
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QrCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QrRegistration" (
    "id" TEXT NOT NULL,
    "qrCodeId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "guardianName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "school" TEXT NOT NULL,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attendedEvent" BOOLEAN NOT NULL DEFAULT false,
    "attendedAt" TIMESTAMP(3),
    "attendedByUserId" TEXT,
    "enrolledCourse" BOOLEAN NOT NULL DEFAULT false,
    "enrolledAt" TIMESTAMP(3),
    "enrolledByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QrRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentMatch" (
    "id" TEXT NOT NULL,
    "vrRecordId" TEXT NOT NULL,
    "qrRegistrationId" TEXT NOT NULL,
    "matchedByUserId" TEXT NOT NULL,
    "matchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentMatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_authUserId_key" ON "User"("authUserId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "VrRecord_assignedQrCodeId_key" ON "VrRecord"("assignedQrCodeId");

-- CreateIndex
CREATE INDEX "VrRecord_firstName_idx" ON "VrRecord"("firstName");

-- CreateIndex
CREATE INDEX "VrRecord_lastName_idx" ON "VrRecord"("lastName");

-- CreateIndex
CREATE INDEX "VrRecord_school_idx" ON "VrRecord"("school");

-- CreateIndex
CREATE INDEX "VrRecord_createdByUserId_idx" ON "VrRecord"("createdByUserId");

-- CreateIndex
CREATE INDEX "VrRecord_createdAt_idx" ON "VrRecord"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "QrCode_serialNumber_key" ON "QrCode"("serialNumber");

-- CreateIndex
CREATE UNIQUE INDEX "QrCode_tokenHash_key" ON "QrCode"("tokenHash");

-- CreateIndex
CREATE INDEX "QrCode_status_idx" ON "QrCode"("status");

-- CreateIndex
CREATE INDEX "QrCode_createdAt_idx" ON "QrCode"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "QrRegistration_qrCodeId_key" ON "QrRegistration"("qrCodeId");

-- CreateIndex
CREATE INDEX "QrRegistration_firstName_idx" ON "QrRegistration"("firstName");

-- CreateIndex
CREATE INDEX "QrRegistration_lastName_idx" ON "QrRegistration"("lastName");

-- CreateIndex
CREATE INDEX "QrRegistration_school_idx" ON "QrRegistration"("school");

-- CreateIndex
CREATE INDEX "QrRegistration_phone_idx" ON "QrRegistration"("phone");

-- CreateIndex
CREATE INDEX "QrRegistration_registeredAt_idx" ON "QrRegistration"("registeredAt");

-- CreateIndex
CREATE INDEX "QrRegistration_attendedEvent_idx" ON "QrRegistration"("attendedEvent");

-- CreateIndex
CREATE INDEX "QrRegistration_enrolledCourse_idx" ON "QrRegistration"("enrolledCourse");

-- CreateIndex
CREATE UNIQUE INDEX "StudentMatch_vrRecordId_key" ON "StudentMatch"("vrRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentMatch_qrRegistrationId_key" ON "StudentMatch"("qrRegistrationId");

-- CreateIndex
CREATE INDEX "StudentMatch_matchedByUserId_idx" ON "StudentMatch"("matchedByUserId");

-- CreateIndex
CREATE INDEX "StudentMatch_matchedAt_idx" ON "StudentMatch"("matchedAt");

-- AddForeignKey
ALTER TABLE "VrRecord" ADD CONSTRAINT "VrRecord_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VrRecord" ADD CONSTRAINT "VrRecord_assignedQrCodeId_fkey" FOREIGN KEY ("assignedQrCodeId") REFERENCES "QrCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QrRegistration" ADD CONSTRAINT "QrRegistration_qrCodeId_fkey" FOREIGN KEY ("qrCodeId") REFERENCES "QrCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QrRegistration" ADD CONSTRAINT "QrRegistration_attendedByUserId_fkey" FOREIGN KEY ("attendedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QrRegistration" ADD CONSTRAINT "QrRegistration_enrolledByUserId_fkey" FOREIGN KEY ("enrolledByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentMatch" ADD CONSTRAINT "StudentMatch_vrRecordId_fkey" FOREIGN KEY ("vrRecordId") REFERENCES "VrRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentMatch" ADD CONSTRAINT "StudentMatch_qrRegistrationId_fkey" FOREIGN KEY ("qrRegistrationId") REFERENCES "QrRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentMatch" ADD CONSTRAINT "StudentMatch_matchedByUserId_fkey" FOREIGN KEY ("matchedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
