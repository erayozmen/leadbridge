-- CreateEnum
CREATE TYPE "DevicePlaybackState" AS ENUM ('IDLE', 'DOWNLOADING', 'PLAYING', 'PAUSED', 'STOPPED', 'ERROR');

-- CreateEnum
CREATE TYPE "DeviceCommandType" AS ENUM ('PLAY_VIDEO', 'STOP');

-- CreateEnum
CREATE TYPE "DeviceCommandStatus" AS ENUM ('PENDING', 'DELIVERED', 'DOWNLOADING', 'PLAYING', 'COMPLETED', 'FAILED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "DeviceVideoStatus" AS ENUM ('DOWNLOADING', 'READY', 'FAILED', 'EVICTED');

-- AlterTable
ALTER TABLE "Device" ADD COLUMN     "currentVideoId" TEXT,
ADD COLUMN     "playbackState" "DevicePlaybackState" NOT NULL DEFAULT 'IDLE',
ADD COLUMN     "playbackUpdatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "DeviceCommand" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "type" "DeviceCommandType" NOT NULL,
    "videoId" TEXT,
    "status" "DeviceCommandStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deliveredAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),

    CONSTRAINT "DeviceCommand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceVideo" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "status" "DeviceVideoStatus" NOT NULL,
    "downloadedAt" TIMESTAMP(3),
    "lastPlayedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeviceVideo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeviceCommand_deviceId_status_createdAt_idx" ON "DeviceCommand"("deviceId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "DeviceCommand_videoId_idx" ON "DeviceCommand"("videoId");

-- CreateIndex
CREATE INDEX "DeviceCommand_createdByUserId_idx" ON "DeviceCommand"("createdByUserId");

-- CreateIndex
CREATE INDEX "DeviceVideo_videoId_idx" ON "DeviceVideo"("videoId");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceVideo_deviceId_videoId_key" ON "DeviceVideo"("deviceId", "videoId");

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_currentVideoId_fkey" FOREIGN KEY ("currentVideoId") REFERENCES "Video"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceCommand" ADD CONSTRAINT "DeviceCommand_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceCommand" ADD CONSTRAINT "DeviceCommand_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceCommand" ADD CONSTRAINT "DeviceCommand_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceVideo" ADD CONSTRAINT "DeviceVideo_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceVideo" ADD CONSTRAINT "DeviceVideo_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Server-only tables: no client access (RLS on, no policies), like the other device tables.
ALTER TABLE "DeviceCommand" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DeviceVideo" ENABLE ROW LEVEL SECURITY;
