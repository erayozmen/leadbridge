import "server-only";

import {
  DeviceCommandStatus,
  DeviceCommandType,
  DevicePlaybackState,
  DeviceVideoStatus,
  VideoStatus,
} from "@prisma/client";
import { z } from "zod";

import { AUDIT_ACTIONS, type AuditAction } from "@/features/audit/constants/audit-actions";
import { AUDIT_ENTITY_TYPES } from "@/features/audit/constants/audit-entity-types";
import { writeAuditLog } from "@/features/audit/services/write-audit-log";
import {
  ACTIVE_POLL_SECONDS,
  DELIVERABLE_COMMAND_STATUSES,
  DOWNLOAD_URL_TTL_SECONDS,
  IDLE_POLL_SECONDS,
  isAllowedCommandTransition,
  isPendingCommandExpired,
  isPlaybackEndReport,
  isStaleAcknowledgement,
  OPEN_COMMAND_STATUSES,
  PLAYING_POLL_SECONDS,
  type ReportableStatus,
} from "@/features/devices/lib/command-policy";
import type { AuthenticatedDevice } from "@/features/devices/server/authenticate-device";
import { DeviceError } from "@/features/devices/services/device-errors";
import { createSignedVideoDownload } from "@/features/videos/services/video-storage";
import { prisma } from "@/lib/prisma";

export type AgentCommand = {
  id: string;
  type: DeviceCommandType;
  videoId: string | null;
  video: { id: string; displayName: string; sizeBytes: string; sha256: string | null; mimeType: string } | null;
};

export type PendingCommands = { commands: AgentCommand[]; pollIntervalSeconds: number };

/** Failure codes that mean the headset has no usable copy of the video. */
const DOWNLOAD_FAILURE_CODES = new Set([
  "DOWNLOAD_FAILED",
  "DOWNLOAD_NOT_AUTHORIZED",
  "CHECKSUM_MISMATCH",
  "SIZE_MISMATCH",
  "STORAGE_FULL",
]);
/** Failure codes reported after a verified file was on disk (the download itself succeeded). */
const PLAYBACK_FAILURE_CODES = new Set(["PLAYER_NOT_STARTED", "PLAYBACK_ERROR"]);

const statusSchema = z
  .object({
    status: z.enum(["DELIVERED", "DOWNLOADING", "PLAYING", "COMPLETED", "FAILED"]),
    // A machine-readable code only: free text could carry paths or URLs into the database.
    error: z.string().regex(/^[A-Z][A-Z0-9_]{0,39}$/).optional(),
  })
  .strict();

const idSchema = z.string().trim().min(1).max(64);

type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

const SYSTEM_ACTOR = { type: "SYSTEM", userId: null } as const;

function commandAudit(
  tx: TransactionClient,
  action: AuditAction,
  deviceId: string,
  command: { id: string; type: DeviceCommandType; videoId: string | null },
  extra: Record<string, unknown> = {},
) {
  return writeAuditLog(tx, {
    actor: SYSTEM_ACTOR,
    action,
    entityType: AUDIT_ENTITY_TYPES.DEVICE,
    entityId: deviceId,
    ...(command.videoId ? { relatedEntity: { type: AUDIT_ENTITY_TYPES.VIDEO, id: command.videoId } } : {}),
    afterData: { commandId: command.id, type: command.type, ...extra },
    metadata: { source: "DEVICE" },
  });
}

/**
 * Returns the command this headset still has to act on, for the heartbeat response. Reading does
 * not change the state: the Agent acknowledges with DELIVERED, so a lost response is simply
 * re-delivered. A command that was never acknowledged in time expires instead of playing late.
 * While a video is PLAYING nothing is delivered, but the shorter interval lets a STOP arrive quickly.
 */
export async function listPendingCommands(deviceId: string, now = new Date()): Promise<PendingCommands> {
  const idle = { commands: [], pollIntervalSeconds: IDLE_POLL_SECONDS };
  // A new command supersedes the open one, so the newest open command is the only one.
  const command = await prisma.deviceCommand.findFirst({
    where: { deviceId, status: { in: [...OPEN_COMMAND_STATUSES] } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      type: true,
      status: true,
      videoId: true,
      createdAt: true,
      video: { select: { id: true, displayName: true, sizeBytes: true, sha256: true, mimeType: true, status: true } },
    },
  });
  if (!command) return idle;
  if (command.status === DeviceCommandStatus.PLAYING) return { commands: [], pollIntervalSeconds: PLAYING_POLL_SECONDS };

  if (command.status === DeviceCommandStatus.PENDING && isPendingCommandExpired(command.createdAt, now)) {
    await prisma.$transaction(async (tx) => {
      const expired = await tx.deviceCommand.updateMany({
        where: { id: command.id, status: DeviceCommandStatus.PENDING },
        data: { status: DeviceCommandStatus.EXPIRED },
      });
      if (expired.count === 1) await commandAudit(tx, AUDIT_ACTIONS.DEVICE_COMMAND_EXPIRED, deviceId, command);
    });
    return idle;
  }

  if (command.type === DeviceCommandType.PLAY_VIDEO && command.video?.status !== VideoStatus.READY) {
    await prisma.$transaction(async (tx) => {
      const failed = await tx.deviceCommand.updateMany({
        where: { id: command.id, status: command.status },
        data: { status: DeviceCommandStatus.FAILED, error: "VIDEO_NOT_AVAILABLE", failedAt: now },
      });
      if (failed.count === 1) {
        await commandAudit(tx, AUDIT_ACTIONS.DEVICE_COMMAND_FAILED, deviceId, command, { error: "VIDEO_NOT_AVAILABLE" });
      }
    });
    return idle;
  }

  const video = command.video;
  return {
    commands: [
      {
        id: command.id,
        type: command.type,
        videoId: command.videoId,
        video: video
          ? { id: video.id, displayName: video.displayName, sizeBytes: video.sizeBytes.toString(), sha256: video.sha256, mimeType: video.mimeType }
          : null,
      },
    ],
    pollIntervalSeconds: ACTIVE_POLL_SECONDS,
  };
}

/** Applies a progress report from the Agent and mirrors it onto the device and its video copy. */
export async function reportCommandStatus(
  device: AuthenticatedDevice,
  rawCommandId: unknown,
  input: unknown,
  now = new Date(),
): Promise<{ status: DeviceCommandStatus }> {
  const commandId = idSchema.parse(rawCommandId);
  const { status, error } = statusSchema.parse(input);
  if (device.status === "DISABLED") throw new DeviceError("DEVICE_DISABLED");

  return prisma.$transaction(async (tx) => {
    const command = await tx.deviceCommand.findUnique({
      where: { id: commandId },
      select: { id: true, deviceId: true, type: true, status: true, videoId: true, createdAt: true, deliveredAt: true, startedAt: true },
    });
    // Another device's command is indistinguishable from a missing one.
    if (!command || command.deviceId !== device.deviceId) throw new DeviceError("COMMAND_NOT_FOUND");
    if (command.status === DeviceCommandStatus.CANCELLED) {
      if (!isPlaybackEndReport(status)) throw new DeviceError("COMMAND_CANCELLED");
      // The superseded player has ended. Keep the command CANCELLED, but let this report correct the
      // device state unless the headset has already taken a newer command (whose state must win).
      const newer = await tx.deviceCommand.findFirst({
        where: { deviceId: device.deviceId, createdAt: { gt: command.createdAt }, deliveredAt: { not: null } },
        select: { id: true },
      });
      if (!newer) await applyPlaybackState(tx, device.deviceId, command, status, now);
      return { status: DeviceCommandStatus.CANCELLED };
    }
    if (command.status === DeviceCommandStatus.EXPIRED) throw new DeviceError("COMMAND_EXPIRED");
    // Too late to act on; the next heartbeat marks it EXPIRED (and audits it).
    if (command.status === DeviceCommandStatus.PENDING && isPendingCommandExpired(command.createdAt, now)) {
      throw new DeviceError("COMMAND_EXPIRED");
    }
    if (isStaleAcknowledgement(command.status, status)) return { status: command.status };
    if (!isAllowedCommandTransition(command.type, command.status, status)) throw new DeviceError("INVALID_COMMAND_TRANSITION");
    // Duplicate report (e.g. a retried request): nothing changes and nothing is audited twice.
    if (command.status === status) return { status };

    const updated = await tx.deviceCommand.updateMany({
      where: { id: command.id, status: command.status },
      data: {
        status,
        ...(command.deliveredAt ? {} : { deliveredAt: now }),
        ...((status === "DOWNLOADING" || status === "PLAYING") && !command.startedAt ? { startedAt: now } : {}),
        ...(status === "COMPLETED" ? { completedAt: now } : {}),
        ...(status === "FAILED" ? { failedAt: now, error: error ?? "UNKNOWN" } : {}),
      },
    });
    if (updated.count !== 1) throw new DeviceError("INVALID_COMMAND_TRANSITION");

    await applyPlaybackState(tx, device.deviceId, command, status, now);

    // The file finished downloading when a DOWNLOADING command moves on to playback (or fails in the player).
    const downloadCompleted =
      command.status === DeviceCommandStatus.DOWNLOADING &&
      (status === "PLAYING" || (status === "FAILED" && !!error && PLAYBACK_FAILURE_CODES.has(error)));

    if (command.type === DeviceCommandType.PLAY_VIDEO && command.videoId) {
      await mirrorDeviceVideo(tx, device.deviceId, command.videoId, status, error, downloadCompleted, now);
    }

    if (status === "DELIVERED") await commandAudit(tx, AUDIT_ACTIONS.DEVICE_COMMAND_DELIVERED, device.deviceId, command);
    if (status === "DOWNLOADING") await commandAudit(tx, AUDIT_ACTIONS.DEVICE_VIDEO_DOWNLOAD_STARTED, device.deviceId, command);
    if (downloadCompleted) await commandAudit(tx, AUDIT_ACTIONS.DEVICE_VIDEO_DOWNLOAD_COMPLETED, device.deviceId, command);
    if (status === "PLAYING") {
      await commandAudit(tx, AUDIT_ACTIONS.DEVICE_VIDEO_PLAYING, device.deviceId, command, { fromDeviceCache: !downloadCompleted });
    }
    if (status === "COMPLETED") await commandAudit(tx, AUDIT_ACTIONS.DEVICE_COMMAND_COMPLETED, device.deviceId, command);
    if (status === "FAILED") {
      await commandAudit(tx, AUDIT_ACTIONS.DEVICE_COMMAND_FAILED, device.deviceId, command, { error: error ?? "UNKNOWN" });
    }
    return { status };
  });
}

/** Mirrors a report onto the reporting device only; other headsets are never touched. */
async function applyPlaybackState(
  tx: TransactionClient,
  deviceId: string,
  command: { type: DeviceCommandType; videoId: string | null },
  status: ReportableStatus,
  now: Date,
) {
  const playback = playbackFor(command.type, status);
  if (!playback) return;
  const keepsVideo = playback === DevicePlaybackState.DOWNLOADING || playback === DevicePlaybackState.PLAYING || playback === DevicePlaybackState.ERROR;
  await tx.device.update({
    where: { id: deviceId },
    data: { playbackState: playback, currentVideoId: keepsVideo ? command.videoId : null, playbackUpdatedAt: now },
    select: { id: true },
  });
}

function playbackFor(type: DeviceCommandType, status: ReportableStatus): DevicePlaybackState | null {
  if (type === DeviceCommandType.STOP) return status === "COMPLETED" ? DevicePlaybackState.STOPPED : null;
  switch (status) {
    case "DELIVERED": return null;
    case "DOWNLOADING": return DevicePlaybackState.DOWNLOADING;
    case "PLAYING": return DevicePlaybackState.PLAYING;
    case "COMPLETED": return DevicePlaybackState.IDLE;
    case "FAILED": return DevicePlaybackState.ERROR;
  }
}

async function mirrorDeviceVideo(
  tx: TransactionClient,
  deviceId: string,
  videoId: string,
  status: ReportableStatus,
  error: string | undefined,
  downloadCompleted: boolean,
  now: Date,
) {
  const where = { deviceId_videoId: { deviceId, videoId } };
  const downloaded = downloadCompleted ? { downloadedAt: now } : {};
  if (status === "DOWNLOADING") {
    await tx.deviceVideo.upsert({
      where,
      create: { deviceId, videoId, status: DeviceVideoStatus.DOWNLOADING },
      update: { status: DeviceVideoStatus.DOWNLOADING, lastError: null },
    });
  } else if (status === "PLAYING") {
    // Playing means the verified file is on the headset (downloaded now or found in its cache).
    await tx.deviceVideo.upsert({
      where,
      create: { deviceId, videoId, status: DeviceVideoStatus.READY, downloadedAt: now, lastPlayedAt: now },
      update: { status: DeviceVideoStatus.READY, lastError: null, lastPlayedAt: now, ...downloaded },
    });
  } else if (status === "FAILED" && downloadCompleted) {
    await tx.deviceVideo.upsert({
      where,
      create: { deviceId, videoId, status: DeviceVideoStatus.READY, downloadedAt: now },
      update: { status: DeviceVideoStatus.READY, lastError: null, downloadedAt: now },
    });
  } else if (status === "FAILED" && error && DOWNLOAD_FAILURE_CODES.has(error)) {
    await tx.deviceVideo.upsert({
      where,
      create: { deviceId, videoId, status: DeviceVideoStatus.FAILED, lastError: error },
      update: { status: DeviceVideoStatus.FAILED, lastError: error },
    });
  }
}

export type VideoDownload = { url: string; expiresInSeconds: number; sizeBytes: string; sha256: string | null };

/**
 * Issues a short-lived signed URL for a video, but only while this device has an open PLAY_VIDEO
 * command for it. The file itself is downloaded directly from Storage, not through Vercel.
 * The URL is returned to the headset only: it is never logged, audited or stored.
 */
export async function createVideoDownload(device: AuthenticatedDevice, rawVideoId: unknown): Promise<VideoDownload> {
  const videoId = idSchema.parse(rawVideoId);
  if (device.status === "DISABLED") throw new DeviceError("DEVICE_DISABLED");

  const command = await prisma.deviceCommand.findFirst({
    where: {
      deviceId: device.deviceId,
      videoId,
      type: DeviceCommandType.PLAY_VIDEO,
      status: { in: [...DELIVERABLE_COMMAND_STATUSES] },
    },
    select: { video: { select: { storagePath: true, sizeBytes: true, sha256: true, status: true } } },
  });
  if (!command?.video) throw new DeviceError("DOWNLOAD_NOT_AUTHORIZED");
  if (command.video.status !== VideoStatus.READY) throw new DeviceError("VIDEO_NOT_AVAILABLE");

  const url = await createSignedVideoDownload(command.video.storagePath, DOWNLOAD_URL_TTL_SECONDS);
  return {
    url,
    expiresInSeconds: DOWNLOAD_URL_TTL_SECONDS,
    sizeBytes: command.video.sizeBytes.toString(),
    sha256: command.video.sha256,
  };
}
