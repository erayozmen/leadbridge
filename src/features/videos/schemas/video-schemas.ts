import { z } from "zod";

import { VIDEO_MAX_UPLOAD_BYTES } from "@/features/videos/lib/video-policy";

const videoId = z.string().trim().min(1).max(64);

export const createVideoUploadSchema = z
  .object({
    filename: z.string().trim().min(1).max(255),
    sizeBytes: z.number().int().positive().max(VIDEO_MAX_UPLOAD_BYTES),
    displayName: z.string().trim().min(1).max(120).optional(),
  })
  .strict();

export const completeVideoUploadSchema = z
  .object({
    videoId,
    sha256: z.string().regex(/^[0-9a-f]{64}$/).optional(),
  })
  .strict();

export const failVideoUploadSchema = z
  .object({
    videoId,
    reason: z.enum(["CANCELLED", "UPLOAD_ERROR"]),
  })
  .strict();

export const videoIdSchema = z.object({ videoId }).strict();
