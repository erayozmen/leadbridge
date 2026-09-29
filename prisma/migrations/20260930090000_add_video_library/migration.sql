-- CreateEnum
CREATE TYPE "VideoStatus" AS ENUM ('UPLOADING', 'READY', 'FAILED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "Video" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sha256" TEXT,
    "durationSeconds" INTEGER,
    "status" "VideoStatus" NOT NULL DEFAULT 'UPLOADING',
    "uploadedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Video_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Video_storagePath_key" ON "Video"("storagePath");

-- CreateIndex
CREATE INDEX "Video_status_createdAt_idx" ON "Video"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Video_uploadedByUserId_idx" ON "Video"("uploadedByUserId");

-- AddForeignKey
ALTER TABLE "Video" ADD CONSTRAINT "Video_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Video" ENABLE ROW LEVEL SECURITY;

-- Private Storage bucket for the video library. Objects are reachable only through short-lived
-- signed URLs issued by the server; no storage.objects policies are granted to anon/authenticated.
-- Skipped where the Supabase storage schema does not exist (plain Postgres test databases).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'buckets') THEN
    BEGIN
      INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
      VALUES ('videos', 'videos', false, 21474836480, ARRAY['video/mp4', 'video/x-m4v', 'video/quicktime'])
      ON CONFLICT (id) DO UPDATE
        SET public = false,
            file_size_limit = EXCLUDED.file_size_limit,
            allowed_mime_types = EXCLUDED.allowed_mime_types;
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE WARNING 'videos bucket was not created (insufficient privilege); create it as a private bucket manually';
    END;
  END IF;
END
$$;
