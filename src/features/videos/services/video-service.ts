import "server-only";

import { randomUUID } from "node:crypto";
import { VideoStatus } from "@prisma/client";

import { AUDIT_ACTIONS } from "@/features/audit/constants/audit-actions";
import { AUDIT_ENTITY_TYPES } from "@/features/audit/constants/audit-entity-types";
import { writeAuditLog } from "@/features/audit/services/write-audit-log";
import { requireAdmin } from "@/features/auth/server/auth";
import { displayNameFromFilename, isIsoBaseMediaFile, resolveVideoFormat, sanitizeVideoFilename } from "@/features/videos/lib/video-file";
import { VIDEO_BUCKET, VIDEO_UPLOAD_CHUNK_BYTES } from "@/features/videos/lib/video-policy";
import {
  completeVideoUploadSchema,
  createVideoUploadSchema,
  failVideoUploadSchema,
  videoIdSchema,
} from "@/features/videos/schemas/video-schemas";
import { VideoError, type VideoFailureReason } from "@/features/videos/services/video-errors";
import {
  createSignedVideoUpload,
  getStoredVideoObject,
  readStoredVideoHead,
  removeStoredVideo,
} from "@/features/videos/services/video-storage";
import { prisma } from "@/lib/prisma";

export type VideoUploadSession = {
  videoId: string;
  upload: {
    endpoint: string;
    /** Signed upload token for exactly this object path. Returned to the uploading admin only. */
    token: string;
    bucket: string;
    objectName: string;
    contentType: string;
    chunkSize: number;
  };
};

const actorOf = (userId: string) => ({ type: "USER" as const, userId });

/** Loads an UPLOADING video that belongs to the acting admin. */
async function loadOwnUpload(videoId: string, actorId: string) {
  const video = await prisma.video.findUnique({
    where: { id: videoId },
    select: { id: true, status: true, storagePath: true, sizeBytes: true, mimeType: true, uploadedByUserId: true },
  });
  if (!video || video.uploadedByUserId !== actorId) throw new VideoError("VIDEO_NOT_FOUND");
  if (video.status !== VideoStatus.UPLOADING) throw new VideoError("VIDEO_STATE_CONFLICT");
  return video;
}

async function markFailed(videoId: string, actorId: string, reason: VideoFailureReason) {
  await prisma.$transaction(async (tx) => {
    const updated = await tx.video.updateMany({
      where: { id: videoId, status: VideoStatus.UPLOADING },
      data: { status: VideoStatus.FAILED },
    });
    if (updated.count !== 1) throw new VideoError("VIDEO_STATE_CONFLICT");
    await writeAuditLog(tx, {
      actor: actorOf(actorId),
      action: AUDIT_ACTIONS.VIDEO_UPLOAD_FAILED,
      entityType: AUDIT_ENTITY_TYPES.VIDEO,
      entityId: videoId,
      beforeData: { status: VideoStatus.UPLOADING },
      afterData: { status: VideoStatus.FAILED },
      metadata: { reason },
    });
  });
}

/**
 * Registers an upload and returns a signed resumable upload session. The object path is derived from
 * a random UUID and a sanitized name, so the uploader's filename can neither collide nor traverse paths.
 */
export async function createVideoUpload(input: unknown): Promise<VideoUploadSession> {
  const data = createVideoUploadSchema.parse(input);
  const actor = await requireAdmin();
  const format = resolveVideoFormat(data.filename);
  if (!format) throw new VideoError("UNSUPPORTED_FORMAT");

  const storagePath = `${randomUUID()}/${sanitizeVideoFilename(data.filename, format)}`;
  const originalFilename = data.filename.split(/[\\/]/).pop()!.slice(0, 255);
  const displayName = data.displayName ?? displayNameFromFilename(data.filename);

  const video = await prisma.$transaction(async (tx) => {
    const created = await tx.video.create({
      data: {
        displayName,
        originalFilename,
        storagePath,
        sizeBytes: BigInt(data.sizeBytes),
        mimeType: format.mimeType,
        status: VideoStatus.UPLOADING,
        uploadedByUserId: actor.id,
      },
      select: { id: true },
    });
    await writeAuditLog(tx, {
      actor: actorOf(actor.id),
      action: AUDIT_ACTIONS.VIDEO_UPLOAD_CREATED,
      entityType: AUDIT_ENTITY_TYPES.VIDEO,
      entityId: created.id,
      afterData: {
        displayName,
        originalFilename,
        sizeBytes: String(data.sizeBytes),
        mimeType: format.mimeType,
        status: VideoStatus.UPLOADING,
      },
    });
    return created;
  });

  let signed;
  try {
    signed = await createSignedVideoUpload(storagePath);
  } catch (error) {
    await markFailed(video.id, actor.id, "UPLOAD_ERROR").catch(() => undefined);
    throw error;
  }

  return {
    videoId: video.id,
    upload: {
      endpoint: signed.endpoint,
      token: signed.token,
      bucket: VIDEO_BUCKET,
      objectName: storagePath,
      contentType: format.mimeType,
      chunkSize: VIDEO_UPLOAD_CHUNK_BYTES,
    },
  };
}

export type CompleteVideoUploadResult =
  | { status: "READY"; videoId: string }
  | { status: "FAILED"; videoId: string; reason: VideoFailureReason };

/**
 * Verifies the object in Storage (existence, exact size, container signature) before marking the
 * video READY. Invalid content is removed from Storage and the record is marked FAILED.
 */
export async function completeVideoUpload(input: unknown): Promise<CompleteVideoUploadResult> {
  const data = completeVideoUploadSchema.parse(input);
  const actor = await requireAdmin();
  const video = await loadOwnUpload(data.videoId, actor.id);

  const stored = await getStoredVideoObject(video.storagePath);
  let failure: VideoFailureReason | null = null;
  if (!stored) failure = "OBJECT_MISSING";
  else if (BigInt(stored.sizeBytes) !== video.sizeBytes) failure = "SIZE_MISMATCH";
  else if (!isIsoBaseMediaFile(await readStoredVideoHead(video.storagePath))) failure = "INVALID_CONTENT";

  if (failure) {
    if (stored) await removeStoredVideo(video.storagePath);
    await markFailed(video.id, actor.id, failure);
    return { status: "FAILED", videoId: video.id, reason: failure };
  }

  await prisma.$transaction(async (tx) => {
    const updated = await tx.video.updateMany({
      where: { id: video.id, status: VideoStatus.UPLOADING },
      data: { status: VideoStatus.READY, sha256: data.sha256 ?? null },
    });
    if (updated.count !== 1) throw new VideoError("VIDEO_STATE_CONFLICT");
    await writeAuditLog(tx, {
      actor: actorOf(actor.id),
      action: AUDIT_ACTIONS.VIDEO_UPLOAD_COMPLETED,
      entityType: AUDIT_ENTITY_TYPES.VIDEO,
      entityId: video.id,
      beforeData: { status: VideoStatus.UPLOADING },
      afterData: { status: VideoStatus.READY, sizeBytes: video.sizeBytes.toString(), sha256Recorded: Boolean(data.sha256) },
    });
  });
  return { status: "READY", videoId: video.id };
}

/** Records a client-side upload failure or cancellation. */
export async function failVideoUpload(input: unknown): Promise<void> {
  const data = failVideoUploadSchema.parse(input);
  const actor = await requireAdmin();
  const video = await loadOwnUpload(data.videoId, actor.id);
  await markFailed(video.id, actor.id, data.reason);
}

/** Hides a video from the library. The Storage object is kept for a later, separate cleanup. */
export async function archiveVideo(input: unknown): Promise<void> {
  const data = videoIdSchema.parse(input);
  const actor = await requireAdmin();

  await prisma.$transaction(async (tx) => {
    const video = await tx.video.findUnique({ where: { id: data.videoId }, select: { status: true, displayName: true } });
    if (!video) throw new VideoError("VIDEO_NOT_FOUND");
    if (video.status === VideoStatus.ARCHIVED) throw new VideoError("VIDEO_STATE_CONFLICT");

    const updated = await tx.video.updateMany({
      where: { id: data.videoId, status: video.status },
      data: { status: VideoStatus.ARCHIVED },
    });
    if (updated.count !== 1) throw new VideoError("VIDEO_STATE_CONFLICT");
    await writeAuditLog(tx, {
      actor: actorOf(actor.id),
      action: AUDIT_ACTIONS.VIDEO_ARCHIVED,
      entityType: AUDIT_ENTITY_TYPES.VIDEO,
      entityId: data.videoId,
      beforeData: { status: video.status, displayName: video.displayName },
      afterData: { status: VideoStatus.ARCHIVED },
    });
  });
}
